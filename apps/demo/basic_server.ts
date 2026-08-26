import { default as express, type Request, type Response } from 'express'
import { Server as IOServer } from 'socket.io'
import http from 'http'
import cors from 'cors'
import morgan from 'morgan'
import bodyparser from 'body-parser'
import path from 'path'
import cookieparser from "cookie-parser"


// 服务应该提供的基本功能
interface Service {

}

// 应用的一般流程
abstract class Application {

}

// 服务
class Server extends Application implements Service {
   protected constructor() {
      super();
   }

}

class GateServer extends Server {
   protected readonly expressApp: express.Application;
   protected readonly webServer: http.Server;
   protected readonly socketIO: IOServer;

   public constructor() {
      super();

      this.expressApp = express();
      this.webServer = http.createServer(this.expressApp);
      this.socketIO = new IOServer(this.webServer)

      this.initApp();
      this.initRouter();
      this.initSocketIOEvent();
   }

   get socketio(): IOServer {
      return this.socketIO;
   }

   initApp() {
      // 跨域问题
      this.expressApp.use(cors({ origin: true, credentials: true }));
      this.expressApp.enable('trust proxy');
      this.expressApp.disable('etag');
      this.expressApp.disable('x-powered-by');

      // http访问日志
      this.expressApp.use(morgan("combined"));
      this.expressApp.use(bodyparser.json());
      this.expressApp.use(bodyparser.urlencoded({ extended: false }));
      this.expressApp.use(cookieparser());

      // web资源地址
      this.expressApp.use(express.static(path.join(__dirname, 'public')));
   }

   initRouter() {
      this.expressApp.get('/hello', (req: Request, res: Response) => {
         res.send({ "txt": "hello world~" })
      })
   }

   initSocketIOEvent() {
      this.socketIO.on('connection', (socket) => {
         socket.emit('news', { hello: 'world' });

         socket.on('msg', (data) => {
            console.log(data);
         });
      });
   }

   run() {
      this.webServer.listen(3000, () => {
         console.log('app is runing!');
      })
   }
}

let gate = new GateServer();
gate.run();
