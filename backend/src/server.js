require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const batchRoutes = require("./routes/batches");
const matchRoutes = require("./routes/matches");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/batches", batchRoutes);
app.use("/api/v1/matches", matchRoutes);

// Must be registered last - catches errors thrown/forwarded from any route above.
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[server] ReconAI backend running on port ${PORT}`));
});

module.exports = app;
