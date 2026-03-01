import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import { limiter } from "./context.js";
import router from "./routes/index.js";

const maskedPwd = config.appPassword!.length > 2 
  ? `${config.appPassword![0]}***${config.appPassword!.slice(-1)}` 
  : "***";
console.log(`Auth enabled: Password expected (${maskedPwd})`);

const app = express();
app.set("trust proxy", 1);

type OriginDecision = boolean | string | RegExp | Array<string | RegExp>;

const corsOptions = {
  origin: (
    requestOrigin: string | undefined, 
    callback: (err: Error | null, allow?: OriginDecision) => void
  ) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!requestOrigin) return callback(null, true);
    if (requestOrigin?.includes("localhost:")) return callback(null, true);
    
    const allowed = config.allowedOrigins === "*" 
      || (Array.isArray(config.allowedOrigins) && config.allowedOrigins.includes(requestOrigin))
      || config.allowedOrigins === requestOrigin;
      
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "OPTIONS"],
};

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan("combined"));
app.use(cors(corsOptions));
app.use(express.json());
app.use(limiter);
app.use("/", router);

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Listening on http://0.0.0.0:${config.port}`);
});

const shutdown = () => {
  try {
    const s = server as unknown as { closeAllConnections?: () => void };
    if (typeof s.closeAllConnections === "function") {
      s.closeAllConnections();
    }
    server.close();
  } catch (err) {
    // Shutdown errors are usually safe to ignore during process exit
  }
  
  setTimeout(() => process.exit(0), 200);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
