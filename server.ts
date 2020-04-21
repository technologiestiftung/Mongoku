import * as path from "path";
import * as fs from "fs";
import http from "http";
import express from "express";
const app = express();

import factory from "./lib/Factory";
import { api } from "./routes/api";

const setupServer = () => {
  const SERVER_PORT = process.env.MONGOKU_SERVER_PORT || 3100;

  app.get("/", (req, res, next) => {
    res.sendFile("app/index.html", { root: __dirname }, (err) => {
      if (err) {
        return next(err);
      }
    });
  });

  app.use("/api", api);

  app.get("/*", (req, res, next) => {
    const ext = path.extname(req.url);

    fs.stat(path.join(__dirname, "app", req.url), (err, stats) => {
      let file = "index.html";
      if (stats && stats.isFile()) {
        file = req.url;
      }

      res.sendFile(file, { root: path.join(__dirname, "app") }, (err) => {
        if (err) {
          return next(err);
        }
      });
    });
  });

  app.use((err: Error, req: express.Request, res: express.Response, next) => {
    res.status(500);

    return res.json({
      ok: false,
      message: err.message,
    });
  });

  server.listen(SERVER_PORT, () =>
    console.log(`[Mongoku] listening on port ` + SERVER_PORT)
  );
};

const server = http.createServer(app);

export const start = async () => {
  console.log(`[Mongoku] Starting...`);
  try {
    await factory.load();
    setupServer();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  (async () => {
    await start();
  })();
}

//  BretFisher / node-docker-good-defaults
// see https://github.com/BretFisher/node-docker-good-defaults/blob/master/bin/www
// need this in docker container to properly exit since node doesn't handle SIGINT/SIGTERM
// this also won't work on using npm start since:
// https://github.com/npm/npm/issues/4603
// https://github.com/npm/npm/pull/10868
// https://github.com/RisingStack/kubernetes-graceful-shutdown-example/blob/master/src/index.js
// if you want to use npm then start with `docker run --init` to help, but I still don't think it's
// a graceful shutdown of node process
//

// TODO: Not strongly types
const sockets: { [key: string]: any } = {};
let nextSocketId = 0;
function waitForSocketsToClose(counter: number): any {
  if (counter > 0) {
    console.log(
      `Waiting ${counter} more ${
        counter === 1 ? "seconds" : "second"
      } for all connections to close...`
    );
    return setTimeout(waitForSocketsToClose, 1000, counter - 1);
  }

  console.log("Forcing all connections to close now");
  for (const socketId in sockets) {
    sockets[socketId].destroy();
  }
}
server.on("connection", function (socket) {
  const socketId = nextSocketId++;
  sockets[socketId] = socket;

  socket.once("close", function () {
    delete sockets[socketId];
  });
});

// shut down server
function shutdown(): void {
  waitForSocketsToClose(10);

  server.close(function onServerClosed(err) {
    if (err) {
      console.error(err);
      process.exitCode = 1;
    }
    process.exit();
  });
}

// quit on ctrl-c when running docker in terminal
process.on("SIGINT", function onSigint() {
  console.info(
    "Got SIGINT (aka ctrl-c in docker). Graceful shutdown ",
    new Date().toISOString()
  );
  shutdown();
});

// quit properly on docker stop
process.on("SIGTERM", function onSigterm() {
  console.info(
    "Got SIGTERM (docker container stop). Graceful shutdown ",
    new Date().toISOString()
  );
  shutdown();
});
