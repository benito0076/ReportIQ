"""Errores del motor, en un modulo liviano: el proceso del servidor los usa para
responder sin importar core/ (que solo se carga en los procesos de trabajo)."""


class ErrorDescarga(Exception):
    pass


class ErrorEntrada(Exception):
    """Error atribuible a los datos enviados (plantilla invalida, etc.)."""
