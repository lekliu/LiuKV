# Stage 1: Build React Frontend
FROM node:20-alpine AS web-builder

WORKDIR /web

COPY web/package*.json ./
RUN npm install

COPY web/ ./
RUN npm run build

# Stage 2: Build Golang Binary
FROM golang:1.26-alpine AS go-builder

WORKDIR /app

RUN echo "https://mirrors.aliyun.com/alpine/v3.19/main" > /etc/apk/repositories && \
    echo "https://mirrors.aliyun.com/alpine/v3.19/community" >> /etc/apk/repositories && \
    apk add --no-cache git

ENV GOPROXY=https://goproxy.cn,direct

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Copy static frontend dist from Stage 1 to Go embed dir
COPY --from=web-builder /internal/ui/dist ./internal/ui/dist

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o liukv main.go

# Stage 3: Minimal Runtime
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=go-builder /app/liukv .

EXPOSE 8787

CMD ["./liukv"]
