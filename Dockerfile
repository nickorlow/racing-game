FROM ubuntu:22.04 

ARG GO_VERSION
ENV GO_VERSION=1.22.1

RUN apt-get update
RUN apt-get install -y wget git gcc make protobuf-compiler

RUN wget -P /tmp "https://dl.google.com/go/go${GO_VERSION}.linux-amd64.tar.gz"
RUN tar -C /usr/local -xzf "/tmp/go${GO_VERSION}.linux-amd64.tar.gz"
RUN rm "/tmp/go${GO_VERSION}.linux-amd64.tar.gz"

ENV GOPATH /go
ENV PATH $GOPATH/bin:/usr/local/go/bin:$PATH
RUN mkdir -p "$GOPATH/src" "$GOPATH/bin" && chmod -R 777 "$GOPATH"

WORKDIR $GOPATH


WORKDIR /app/server

COPY ./server/go.mod ./server/go.sum ./
RUN go mod download
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest


WORKDIR /app

COPY ./ ./
WORKDIR /app/server
RUN CGO_ENABLED=0 GOOS=linux make build
EXPOSE 8080

CMD ["/app/server/server"]
