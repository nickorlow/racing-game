.PHONY: run proto

proto: 
	protoc --go_out=. --proto_path=../protocol/ ../protocol/protocol.proto

build: proto
	go build -o server . && chmod +x ./server

run: build
	./server

clean:
	rm -rf pb/ server
