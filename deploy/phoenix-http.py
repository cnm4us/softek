"""Pinned Phoenix 20.21.3, HTTP collector/UI only; never bind its gRPC port."""
from importlib.metadata import version

if version("arize-phoenix") != "20.21.3":
    raise RuntimeError("Reverify HTTP-only startup before upgrading Phoenix")

from phoenix.server import app

_GrpcServer = app.GrpcServer


class HTTPOnlyGrpcServer(_GrpcServer):
    def __init__(self, *args, **kwargs):
        kwargs["disabled"] = True
        super().__init__(*args, **kwargs)


app.GrpcServer = HTTPOnlyGrpcServer

from phoenix.server.main import main

main()
