#/usr/bin/python
from optparse import OptionParser
import os

from app import app, startup

def main(environment):
    port = 5000
    if options.environment == "heroku":
        port = int(os.getenv("PORT"))

    class Config(object):
        def __init__(self, environemnt, port):
            self.ENVIRONMENT = environment
            self.LOGGER_NAME = "bigboy"
            self.PORT = port

    config = Config(environment, port)
    app.config.from_object(config)
    startup()


if __name__ == "__main__":
    parser = OptionParser()
    parser.add_option("-e", "--env", dest="environment",
                      help="ENV in which bigboy will run",
                      default="app", metavar="ENV")
    (options, args) = parser.parse_args()

    main(options.environment)
