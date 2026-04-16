FROM docker.io/golang:1.22-alpine AS build

ARG TARGETOS
ARG TARGETARCH

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
COPY public ./public

RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} go build -o /out/wordle-go ./main.go

FROM docker.io/alpine:3.20

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /out/wordle-go /app/wordle-go
COPY --from=build /src/public /app/public

ENV PORT=3000
EXPOSE 3000

USER app

ENTRYPOINT ["/app/wordle-go"]
