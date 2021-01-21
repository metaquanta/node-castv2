const protobuf = require("protobufjs");

protobuf.load(`${__dirname}/cast_channel.proto`, onLoad);

const messages = [
  "CastMessage",
  "AuthChallenge",
  "AuthResponse",
  "AuthError",
  "DeviceAuthMessage",
];

const extensions = [];

function onLoad(err, root) {
  if (err) throw err;

  messages.forEach((message) => {
    extensions[message] = root.lookupType(`extensions.api.cast_channel.${message}`);
  });
}

messages.forEach((message) => {
  module.exports[message] = {
    serialize(data) {
      if (!extensions[message]) {
        throw new Error("extension not loaded yet");
      }
      const Message = extensions[message];
      return Message.encode(data).finish();
    },
    parse(data) {
      if (!extensions[message]) {
        throw new Error("extension not loaded yet");
      }
      const Message = extensions[message];
      return Message.decode(data);
    },
  };
});
