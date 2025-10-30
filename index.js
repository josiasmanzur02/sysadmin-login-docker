import express from "express";
import bodyParser from "body-parser";

const app = express(); 
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies 
app.use(bodyParser.urlencoded({ extended: true}));
app.use(express.static("public"));

const username = "admin";
const password = "password";
 
// Sample route
app.get('/', (req, res) => {
  res.render("login.ejs"); 
});
 
// Authentication route
app.post('/', (req, res) => {
    const usernameInput = req.body.username;
    const passwordInput = req.body.password;

    if (usernameInput === username && passwordInput === password) {
        res.render("success.ejs");
    } else {
        res.render("invalid.ejs");
    }
});
 
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});