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


# DUST3R DEPENDENCIES START
ENV updated-adds-on 14-DEC-17
ENV PATH="/root/miniconda3/bin:${PATH}" 
ARG PATH="/root/miniconda3/bin:${PATH}"
# RUN apt-get update

# RUN apt-get install -y wget && rm -rf /var/lib/apt/lists/*

RUN wget \
    https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh \
    && mkdir /root/.conda \
    && bash Miniconda3-latest-Linux-x86_64.sh -b \
    && rm -f Miniconda3-latest-Linux-x86_64.sh 
RUN conda --version

WORKDIR /app/scene_recreation
RUN git clone --recursive https://github.com/naver/dust3r

WORKDIR /app/scene_recreation/dust3r

RUN conda init bash \
    && . ~/.bashrc \
    && conda create -n dust3r python=3.11 cmake=3.14.0 -y \
    && conda activate dust3r \
    && conda install pytorch torchvision pytorch-cuda=12.1 -c pytorch -c nvidia -y \
    && pip install -r requirements.txt \
    && pip install -r requirements_optional.txt

# Optional: you can also install additional packages to:
# - add support for HEIC images
RUN pip install -r requirements_optional.txt
# DUST3R DEPENDENCIES END

RUN cd croco/models/curope/ \
    && python setup.py build_ext --inplace \

RUN mkdir -p checkpoints/
RUN wget https://download.europe.naverlabs.com/ComputerVision/DUSt3R/DUSt3R_ViTLarge_BaseDecoder_512_dpt.pth -P checkpoints/

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
