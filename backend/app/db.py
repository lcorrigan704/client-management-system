from contextvars import ContextVar

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker, with_loader_criteria

from .config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()
_current_workspace_id: ContextVar[int | None] = ContextVar("current_workspace_id", default=None)


def set_current_workspace_id(workspace_id: int | None):
    return _current_workspace_id.set(workspace_id)


def reset_current_workspace_id(token):
    _current_workspace_id.reset(token)


def get_current_workspace_id() -> int | None:
    return _current_workspace_id.get()


@event.listens_for(Session, "do_orm_execute")
def _scope_workspace_selects(execute_state):
    workspace_id = get_current_workspace_id()
    if workspace_id is None or not execute_state.is_select:
        return
    from . import models

    scoped_models = (
        models.Client,
        models.Invoice,
        models.Quote,
        models.InvoiceLineItem,
        models.CreditNote,
        models.CreditNoteLineItem,
        models.Refund,
        models.QuoteLineItem,
        models.ServiceAgreement,
        models.ServiceAgreementSLA,
        models.Proposal,
        models.ProposalRequirement,
        models.ProposalAttachment,
        models.ServiceAgreementVersion,
        models.ProposalVersion,
        models.AgreementVersionComment,
        models.AgreementVersionCommentReaction,
        models.ProposalVersionComment,
        models.ProposalVersionCommentReaction,
        models.Expense,
        models.ExpenseReceipt,
        models.EmailLog,
        models.InvoicePayment,
        models.PaymentTaxAllocation,
        models.Settings,
        models.TaxRateCatalog,
    )
    execute_state.statement = execute_state.statement.options(
        *[
            with_loader_criteria(
                model,
                lambda cls: cls.workspace_id == workspace_id,
                include_aliases=True,
            )
            for model in scoped_models
        ]
    )


@event.listens_for(Session, "before_flush")
def _set_workspace_on_new_rows(session, flush_context, instances):
    workspace_id = get_current_workspace_id()
    if workspace_id is None:
        return
    for obj in session.new:
        if hasattr(obj, "workspace_id") and getattr(obj, "workspace_id", None) is None:
            setattr(obj, "workspace_id", workspace_id)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
