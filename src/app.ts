import express from "express";
import cors from "cors";
// import helmet from "helmet";
// import userRoute from "./router/user.route";
// import dashboardRoute from "./router/dashboard.route";
// import inventoryRoute from "./router/inventory.route";
import adminRoutes from "./router/admin.routes";
import cookieParser from "cookie-parser";

// const rateLimit = require('express-rate-limit');

const app = express();


// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.',
// });

// app.use(limiter);

// app.use(helmet());


app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));


app.use(cookieParser());


app.use(express.static("public"));

// Routes
// app.use('/api/auth', userRoute);
// app.use('/api/dashboard', dashboardRoute);
// app.use('/api/inventory', inventoryRoute);

app.use('/api/v1/admin', adminRoutes);

export default app;
