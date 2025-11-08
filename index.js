import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import pg from "pg";
import dotenv from "dotenv";
import session from "express-session";
import pgSession from "connect-pg-simple";

dotenv.config();// uses .env file to store password and db details as well as port

const app = express(); 

app.set("view engine", "ejs");

let quiz = [];            // Stores flags from database

const db = new pg.Client({//create new db client with details from .env file
  connectionString: process.env.DATABASE_URL,
});

db.connect();//start connection to db

app.set("trust proxy", 1);

const PgSession = pgSession(session);

const cookieSecure = process.env.COOKIE_SECURE === "true";

app.use( 
  session({ 
    store: new PgSession({
      pool: db, 
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      maxAge: 1000 * 60 * 60, // 1 hour per session
      secure: cookieSecure,
      sameSite: cookieSecure ? "none" : "lax",
    },
  })
);

// Middleware to parse JSON bodies 
app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public")); 
 
// Login and registration pages
app.get("/", (req, res) => res.render("login.ejs"));
app.get("/register", (req, res) => res.render("register.ejs"));
 
// Registration route  
app.post('/registration', async (req, res) => { 
  const { username, password, confirmPassword } = req.body;

  try {
    // Validate inputs
    if (!username || !password || !confirmPassword) {
      return res.render("register.ejs", { error: "All fields are required." });
    }

    // Confirm passwords match
    if (password !== confirmPassword) {
      return res.render("register.ejs", { error: "Passwords do not match." });
    }

    // Check if username already exists
    const userExists = await db.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.render("register.ejs", { error: "Username already taken." });
    }

    // ensures username and password have a limit 
    if (username.length < 3) {
      return res.render("register.ejs", { error: "Username must be at least 3 characters." });
    }
    if (password.length < 6) {
      return res.render("register.ejs", { error: "Password must be at least 6 characters." });
    }

    // Hash the password securely using salt rounds and then hashing
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);

    // Store the new user in the database
    await db.query( 
      "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
      [username, hash] 
    );  
 
    // Respond with success 
    res.render("register.ejs", { message: "User registered successfully!" });
  } catch (err) {
    res.render("register.ejs", { error: "Registration failed. Try again." });
  }
});


app.post("/login", async (req, res) => { 
  const { username, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];

    if (!user) return res.render("login.ejs", { error: "Invalid user or password" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.render("login.ejs", { error: "Invalid user or password" });

    // Store user info in session
    req.session.user = {
      id: user.id,
      username: user.username,
    };

    // Load flag data and start the game
    const flags = await db.query("SELECT * FROM flags");
    quiz = flags.rows;

    resetGameState(req.session);
    const question = await nextQuestion(req.session);

    req.session.username = user.username;

    // Render game view 
    res.render("flagguess.ejs", {
      question,
      totalScore: req.session.game.totalCorrect,
      wasCorrect: null,
      username: req.session.username
    });
  } catch (err) {
    res.render("login.ejs", { error: "Login failed. Try again." });
  }
});

app.post("/submit", requireLogin, async (req, res) => {
  const answer = (req.body.answer || "").trim();
  let isCorrect = false;

  try {
    const gameState = ensureGameState(req.session);
    if (!req.session.currentQuestion) {
      await nextQuestion(req.session);
    }
    const previousQuestion = req.session.currentQuestion; // store the flag being shown

    if (!previousQuestion) {
      return res.redirect("/flagguess");
    }

    if ( previousQuestion.name.toLowerCase() === answer.toLowerCase()) {
      gameState.totalCorrect++; 
      gameState.currentStreak++; 
      isCorrect = true;
 
      await updateHighscore(req.session.user.id, true, gameState.currentStreak);

      // Only move to the next question if correct
      await nextQuestion(req.session);
    } else {
      // Wrong answer — don’t move to next flag
      gameState.currentStreak = 0;
      await updateHighscore(req.session.user.id, false, gameState.currentStreak);
    }

    res.render("flagguess.ejs", {
      question: isCorrect ? req.session.currentQuestion : previousQuestion, // stay on same one if wrong
      totalScore: gameState.totalCorrect,
      wasCorrect: isCorrect,
      username: req.session.username,
      previousAnswer: !isCorrect ? previousQuestion.name : null, // correct answer shown only if wrong
    });
  } catch (err) {
    console.error("Error updating highscore:", err);
    res.status(500).json({ error: "Error processing guess" });
  }
}); 
 
// View Leaderboard
app.get("/leaderboard", requireLogin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.username,
        h.highest_streak,
        h.total_correct,
        h.total_attempts,
        CASE 
          WHEN h.total_attempts > 0 
          THEN ROUND((h.total_correct::decimal / h.total_attempts) * 100, 1)
          ELSE 0
        END AS accuracy
      FROM flag_highscores h
      JOIN users u ON u.id = h.user_id
      ORDER BY h.highest_streak DESC, accuracy DESC
      LIMIT 10;
    `);  
 
    res.render("leaderboard.ejs", { highscores: result.rows });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ error: "Error loading leaderboard" });
  }
});

app.get("/flagguess", requireLogin, async (req, res) => {
  try {
    // Make sure quiz data is loaded 
    if (quiz.length === 0) {
      const flags = await db.query("SELECT * FROM flags");
      quiz = flags.rows;
    }

    // Start a fresh game when visiting the page directly
    resetGameState(req.session);
    const question = await nextQuestion(req.session);

    res.render("flagguess.ejs", { 
      question,  
      totalScore: req.session.game.totalCorrect,
      wasCorrect: null,
      username: req.session.user.username,
    });
  } catch (err) {
    console.error("Error loading game page:", err);
    res.status(500).json({ error: "Could not load game." });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout error:", err); 
    res.redirect("/");
  });
});

function ensureGameState(session) {
  if (!session) return { totalCorrect: 0, currentStreak: 0 };

  if (!session.game) {
    session.game = { totalCorrect: 0, currentStreak: 0 };
  }

  if (typeof session.currentQuestion === "undefined") {
    session.currentQuestion = null;
  }

  return session.game;
}

function resetGameState(session) {
  if (!session) return;
  session.game = { totalCorrect: 0, currentStreak: 0 };
  session.currentQuestion = null;
}

// Randomly select next flag
async function nextQuestion(session) {
  if (quiz.length === 0) {
    const result = await db.query("SELECT * FROM flags");
    quiz = result.rows;
  }

  if (!session) {
    return null;
  }

  const randomCountry = quiz[Math.floor(Math.random() * quiz.length)];
  session.currentQuestion = randomCountry; 
  console.log(session.currentQuestion = randomCountry);
  return randomCountry;
}

async function updateHighscore(userId, isCorrect, streak) {
  if (!userId) return;

  await db.query(
    ` 
    INSERT INTO flag_highscores (user_id, highest_streak, total_correct, total_attempts)
    VALUES ($1, $2, $3, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      highest_streak = GREATEST(flag_highscores.highest_streak, EXCLUDED.highest_streak),
      total_correct = flag_highscores.total_correct + (CASE WHEN EXCLUDED.total_correct > 0 THEN 1 ELSE 0 END),
      total_attempts = flag_highscores.total_attempts + 1,
      last_played = NOW();
    `,
    [userId, streak, isCorrect ? 1 : 0]
  );
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/"); // send back to login 
  }
  next(); 
}

// 404 page to handle routes not managed
app.use((req, res) => {
  res.render("404.ejs", { error: "Page not found" });
});

// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
}); 
