const {EventEmitter} = require("events");
const tls = require("tls");
const debug = require("debug")("castv2");
const protocol = require("./proto");
const PacketStreamWrapper = require("./packet-stream-wrapper");

const {CastMessage} = protocol;

class Server extends EventEmitter {
  constructor(options) {
    super();

    this.server = new tls.Server(options);
    this.clients = {};
  }
  listen(...args) {
    let callback;
    if (typeof args[args.length - 1] === "function") {
      callback = args.pop();
    }

    this.server.listen.apply(this.server, args.concat([onlisten]));

    this.server.on("secureConnection", onconnect);
    this.server.on("error", onerror);
    this.server.once("close", onshutdown);

    const onlisten = () => {
      const addr = this.server.address();
      debug("server listening on %s:%d", addr.address, addr.port);
      if (callback) callback();
    };

    const onconnect = (socket) => {
      debug("connection from %s:%d", socket.remoteAddress, socket.remotePort);
      const ps = new PacketStreamWrapper(socket);

      const clientId = genClientId(socket);

      ps.on("packet", onpacket);
      socket.once("close", ondisconnect);

      const onpacket = (buf) => {
        const message = CastMessage.deserializeBinary(buf);

        debug(
          "recv message: clientId=%s protocolVersion=%s sourceId=%s destinationId=%s namespace=%s data=%s",
          clientId,
          message.protocolVersion,
          message.sourceId,
          message.destinationId,
          message.namespace,
          message.payloadType === 1 // BINARY
            ? inspect(message.payloadBinary)
            : message.payloadUtf8
        );

        if (message.protocolVersion !== 0) {
          // CASTV2_1_0
          debug(
            "client error: clientId=%s unsupported protocol version (%s)",
            clientId,
            message.protocolVersion
          );
          const {socket} = this.clients[clientId];
          socket.end();
          return;
        }

        this.emit(
          "message",
          clientId,
          message.sourceId,
          message.destinationId,
          message.namespace,
          message.payloadType === 1 // BINARY
            ? message.payloadBinary
            : message.payloadUtf8
        );
      };

      const ondisconnect = () => {
        debug("client %s disconnected", clientId);
        ps.removeListener("packet", onpacket);
        delete this.clients[clientId];
      };

      this.clients[clientId] = {
        socket: socket,
        ps: ps,
      };
    };

    const onshutdown = () => {
      debug("server shutting down");
      this.server.removeListener("secureConnection", onconnect);
      this.emit("close");
    };

    const onerror = (err) => {
      debug("error: %s %j", err.message, err);
      this.emit("error", err);
    };
  }
  close() {
    this.server.close();
    for (const clientId in this.clients) {
      const {socket} = this.clients[clientId];
      socket.end();
    }
  }
  send(clientId, sourceId, destinationId, namespace, data) {
    const message = {
      protocolVersion: 0,
      sourceId: sourceId,
      destinationId: destinationId,
      namespace: namespace,
    };

    if (Buffer.isBuffer(data)) {
      message.payloadType = 1; // BINARY;
      message.payloadBinary = data;
    } else {
      message.payloadType = 0; // STRING;
      message.payloadUtf8 = data;
    }

    debug(
      "send message: clientId=%s protocolVersion=%s sourceId=%s destinationId=%s namespace=%s data=%s",
      clientId,
      message.protocolVersion,
      message.sourceId,
      message.destinationId,
      message.namespace,
      message.payloadType === 1 // BINARY
        ? inspect(message.payloadBinary)
        : message.payloadUtf8
    );

    const buf = CastMessage.serialize(message);
    const {ps} = this.clients[clientId];
    ps.send(buf);
  }
}

function genClientId(socket) {
  return [socket.remoteAddress, socket.remotePort].join(":");
}

module.exports = Server;
