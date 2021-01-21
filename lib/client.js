import { EventEmitter } from "events";
import { connect as tlsconnect } from "tls";
import _debug from "debug";
import { extensions } from "./cast_channel.proto.js";
import PacketStreamWrapper from "./packet-stream-wrapper.js";
import Channel from "./channel.js";

const CastMessage = extensions.api.cast_channel.CastMessage;
const debug = _debug("castv2");

class Client extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.ps = null;
  }
  connect(options, callback) {
    if (typeof options === "string") {
      options = {
        host: options,
      };
    }

    options.port = options.port || 8009;
    options.rejectUnauthorized = false;

    if (callback) this.once("connect", callback);

    debug("connecting to %s:%d ...", options.host, options.port);

    this.socket = tlsconnect(options, () => {
      this.ps = new PacketStreamWrapper(this.socket);
      this.ps.on("packet", onpacket);

      debug("connected");
      this.emit("connect");
    });

    const onerror = (err) => {
      debug("error: %s %j", err.message, err);
      this.emit("error", err);
    };

    const onclose = () => {
      debug("connection closed");
      this.socket.removeListener("error", onerror);
      this.socket = null;
      if (this.ps) {
        this.ps.removeListener("packet", onpacket);
        this.ps = null;
      }
      this.emit("close");
    };

    this.socket.on("error", onerror);
    this.socket.once("close", onclose);

    const onpacket = (buf) => {
      const message = CastMessage.decode(buf);

      debug(
        "recv message: protocolVersion=%s sourceId=%s destinationId=%s namespace=%s data=%s",
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
        this.emit(
          "error",
          new Error(`Unsupported protocol version: ${message.protocolVersion}`)
        );
        this.close();
        return;
      }

      this.emit(
        "message",
        message.sourceId,
        message.destinationId,
        message.namespace,
        message.payloadType === 1 // BINARY
          ? message.payloadBinary
          : message.payloadUtf8
      );
    };
  }
  close() {
    debug("closing connection ...");
    // using socket.destroy here because socket.end caused stalled connection
    // in case of dongles going brutally down without a chance to FIN/ACK
    if (this.socket?.destroy) this.socket.destroy();
  }
  send(sourceId, destinationId, namespace, data) {
    const message = {
      protocolVersion: 0, // CASTV2_1_0
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
      "send message: protocolVersion=%s sourceId=%s destinationId=%s namespace=%s data=%s",
      message.protocolVersion,
      message.sourceId,
      message.destinationId,
      message.namespace,
      message.payloadType === 1 // BINARY
        ? inspect(message.payloadBinary)
        : message.payloadUtf8
    );

    const buf = CastMessage.encode(message).finish();
    this.ps.send(buf);
  }
  createChannel(sourceId, destinationId, namespace, encoding) {
    return new Channel(this, sourceId, destinationId, namespace, encoding);
  }
}

export default Client;
