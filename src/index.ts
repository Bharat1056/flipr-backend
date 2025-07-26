import dotenv from "dotenv";
import app from "./app";

dotenv.config({
  path: ".env",
});

app.on("error", (error) => {
  console.log("Express doesn't connect to our database: ", error);
  throw error;
});
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`App listening on: ${process.env.PORT} PORT Number`);
});
