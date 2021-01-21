lib/cast_channel.proto.js: lib/cast_channel.proto
	node_modules/protobufjs/bin/pbjs -t static-module -w es6 -o $@ $<

private-key.pem:
	openssl genrsa -out $@ 1024

csr.pem: private-key.pem
	openssl req -new -key $< -out $@

public-cert.pem: private-key.pem csr.pem
	openssl x509 -req -in csr.pem -signkey private-key.pem -out $@

proto: lib/cast_channel.proto.js

tls: private-key.pem public-cert.pem

clean:
	rm lib/cast_channel.desc private-key.pem csr.pem public-cert.pem

.PHONY: clean proto tls

