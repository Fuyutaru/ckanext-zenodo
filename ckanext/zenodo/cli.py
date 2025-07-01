import click


@click.group(short_help="zenodo CLI.")
def zenodo():
    """zenodo CLI.
    """
    pass


@zenodo.command()
@click.argument("name", default="zenodo")
def command(name):
    """Docs.
    """
    click.echo("Hello, {name}!".format(name=name))


def get_commands():
    return [zenodo]
