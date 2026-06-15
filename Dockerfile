FROM node:20-alpine AS web
WORKDIR /web
COPY apps/web/package.json apps/web/pnpm-lock.yaml* ./
RUN corepack enable && (pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
COPY apps/web/ ./
RUN mkdir -p ../server/cmd/sharehub/static && pnpm build

FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY apps/server/go.mod apps/server/go.sum ./
RUN go mod download
COPY apps/server/ ./
COPY --from=web /server/cmd/sharehub/static ./cmd/sharehub/static
RUN CGO_ENABLED=0 go build -o /sharehub ./cmd/sharehub

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /sharehub /app/sharehub
ENV SHAREHUB_ADDR=:8080
ENV SHAREHUB_DATA_DIR=/data
EXPOSE 8080
VOLUME /data
ENTRYPOINT ["/app/sharehub"]
