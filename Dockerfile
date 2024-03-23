FROM nvcr.io/nvidia/pytorch:24.01-py3

# Python Setup

LABEL description="Docker container for DUSt3R with dependencies installed. CUDA VERSION"
ENV DEVICE="cuda"
ENV MODEL="DUSt3R_ViTLarge_BaseDecoder_512_dpt.pth"
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    git=1:2.34.1-1ubuntu1.10 \
    libglib2.0-0=2.72.4-0ubuntu2.2 python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/scene_recreation/
RUN git clone --recursive https://github.com/naver/dust3r ./dust3r
WORKDIR /app/scene_recreation/dust3r
RUN pip install -r requirements.txt
RUN pip install -r requirements_optional.txt
RUN pip install opencv-python==4.8.0.74
RUN pip install open3d

WORKDIR /app/scene_recreation/dust3r/croco/models/curope/
RUN python setup.py build_ext --inplace

# Install patched library
#RUN tar xzf open3d_noavx.tar.gz -C /usr/local/lib/python3.10/dist-packages 

WORKDIR /app/scene_recreation/dust3r
RUN mkdir -p checkpoints/
RUN wget https://download.europe.naverlabs.com/ComputerVision/DUSt3R/DUSt3R_ViTLarge_BaseDecoder_512_dpt.pth -P checkpoints/

# Go Setup

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
# goofy to do this here but not fucking up caches is preferable
RUN apt install -y libx11-dev libgl1-mesa-glx
EXPOSE 8080

CMD ["/app/server/server"]
