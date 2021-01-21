const {EventEmitter} = require("events");

class Channel extends EventEmitter {
  constructor(bus, sourceId, destinationId, namespace, encoding) {
    super();

    this.bus = bus;
    this.sourceId = sourceId;
    this.destinationId = destinationId;
    this.namespace = namespace;
    this.encoding = encoding;

    this.bus.on("message", onmessage);
    this.once("close", onclose);

    const onmessage = (sourceId, destinationId, namespace, data) => {
      if (sourceId !== this.destinationId) return;
      if (destinationId !== this.sourceId && destinationId !== "*") return;
      if (namespace !== this.namespace) return;
      this.emit("message", decode(data, this.encoding), destinationId === "*");
    };

    const onclose = () => {
      this.bus.removeListener("message", onmessage);
    };
  }
  send(data) {
    this.bus.send(
      this.sourceId,
      this.destinationId,
      this.namespace,
      encode(data, this.encoding)
    );
  }
  close() {
    this.emit("close");
  }
}

function encode(data, encoding) {
  if (!encoding) return data;
  switch (encoding) {
    case "JSON":
      return JSON.stringify(data);
    default:
      throw new Error(`Unsupported channel encoding: ${encoding}`);
  }
}

function decode(data, encoding) {
  if (!encoding) return data;
  switch (encoding) {
    case "JSON":
      return JSON.parse(data);
    default:
      throw new Error(`Unsupported channel encoding: ${encoding}`);
  }
}

module.exports = Channel;
