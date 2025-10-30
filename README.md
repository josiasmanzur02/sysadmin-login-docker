# sysadmin-login-docker

Simple Express + EJS login demo intended for local development and experimentation as project for my Systems Administration class.

## Features
- Express server serving EJS views
- Static assets from `public/`
- Simple username/password check (for demo purposes only)

## Prerequisites
- Node.js 14+ and npm

## Install
1. Clone the repo
2. Install dependencies
```bash
npm install
```

## Run
Start the app:
```bash
node index.js
```
The server listens on `PORT` environment variable or default `3000`:
```
http://localhost:3000
```

## Default credentials (demo only)
- username: `admin`
- password: `password`

## Notes
- This project stores credentials in plain text for demonstration. Do not use this pattern in production.
- Consider adding a `.env` file and using a proper authentication flow for real projects.
- Add a start script to `package.json` if desired:
```json
"scripts": {
  "start": "node index.js"
}
```

## License
Unlicensed / demo
