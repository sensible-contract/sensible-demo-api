import { SwaggerRouter } from "koa-swagger-decorator";
import path from "path";

// init router
const router = new SwaggerRouter();

// load controllers
router.mapDir(path.resolve(__dirname, "../routes"));

// dump swagger json
router.dumpSwaggerJson({
  filename: "swagger.json", // default is swagger.json
  dir: process.cwd(), // default is process.cwd()
});
