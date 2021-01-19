const {EventEmitter} = require("events");

const WAITING_HEADER = 0;
const WAITING_PACKET = 1;

class PacketStreamWrapper extends EventEmitter {
  constructor(stream) {
    super();
    //EventEmitter.call(this);

    this.stream = stream;

    let state = WAITING_HEADER;
    let packetLength = 0;

    this.stream.on("readable", () => {
      while (true) {
        switch (state) {
          case WAITING_HEADER:
            const header = stream.read(4);
            if (header === null) return;
            packetLength = header.readUInt32BE(0);
            state = WAITING_PACKET;
            break;
          case WAITING_PACKET:
            const packet = stream.read(packetLength);
            if (packet === null) return;
            this.emit("packet", packet);
            state = WAITING_HEADER;
            break;
        }
      }
    });
  }
  send(buf) {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(buf.length, 0);
    this.stream.write(Buffer.concat([header, buf]));
  }
}

module.exports = PacketStreamWrapper;
