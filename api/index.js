const express = require("express");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const env = (process.env.NODE_ENV || "production").toLowerCase();
const isProduction = env === "production";

const envFile = isProduction ? ".env" : ".env.development.local";
dotenv.config({ path: envFile });

const app = express();

if (process.env.NODE_ENV === "development") {
  const morgan = require("morgan");
  app.use(morgan("dev"));
}
app.set("trust proxy", 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many API requests from this IP, please try again in 15 minutes.",
});
app.use(limiter);

const corsOptions = {
  origin: isProduction ? (process.env.CORS_ALLOWED_ORIGINS || "").split(",") : "*",
  methods: "GET,HEAD,POST,OPTIONS",
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

app.get("/", async (_req, res) => {
  res.status(200).json("Home");
});

app.post("/recipes", async (req, res) => {
  try {
    const { searchKeyword, ingredients } = req.body;
    const { EDAMAM_APP_ID: appId, EDAMAM_APP_KEY: appKey } = process.env;

    if (!appKey || !appId) {
      res.status(500).json({ error: "API credentials are missing" });
    } else {
      if (!searchKeyword || typeof searchKeyword !== "string" || searchKeyword.length < 3) {
        res.status(400).json({ error: "Search keyword must be a valid string with 3+ characters" });
      } else {
        if (!ingredients) {
          res.status(400).json({ error: "Ingredients should be defined (use a comma-separated list if multiple)" });
        } else {
          const recipeApiUrl = "https://api.edamam.com/api/recipes/v2";
          const urlParameters = `${recipeApiUrl}?q=${searchKeyword} ${ingredients.join(" ")}&app_id=${appId}&app_key=${appKey}&type=public`;

          const response = await axios.get(urlParameters);
          const recipes = response.data.hits.map(({ recipe }) => {
            const { image, ingredientLines, label } = recipe;
            return { image, ingredientLines, label };
          });

          res.status(200).json(recipes);
        }
      }
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

const PORT = process.env.PORT || (isProduction ? 8080 : 3000);
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} (${env})`);
});

if (isProduction) server.timeout = 10000;