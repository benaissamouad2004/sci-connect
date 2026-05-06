# ROUTE: Modèles SQLAlchemy — SciConnect V3
from datetime import datetime
import uuid
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id                      = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    google_id               = db.Column(db.String(100), unique=True, nullable=False)
    email                   = db.Column(db.String(200), nullable=False)
    name                    = db.Column(db.String(200))
    avatar_url              = db.Column(db.String(500))
    school_id               = db.Column(db.String(50))
    university_id           = db.Column(db.String(10))
    level                   = db.Column(db.String(20))
    domains                 = db.Column(db.JSON)
    why_join                = db.Column(db.JSON)
    available_time          = db.Column(db.String(50))
    respond_domains         = db.Column(db.JSON)
    points                  = db.Column(db.Integer, default=0)
    badge_level             = db.Column(db.String(20), default='novice')
    # V3: système de points — monthly_responses_given conservé pour migration
    monthly_responses_given = db.Column(db.Integer, default=0)
    monthly_reset_date      = db.Column(db.Date)
    # V3: nouveau système points
    streak                  = db.Column(db.Integer, default=0)
    last_login_date         = db.Column(db.Date, nullable=True)
    total_responses_given   = db.Column(db.Integer, default=0)
    total_forms_posted      = db.Column(db.Integer, default=0)
    is_founder              = db.Column(db.Boolean, default=False)
    onboarding_complete     = db.Column(db.Boolean, default=False)
    created_at              = db.Column(db.DateTime, default=datetime.utcnow)
    last_active             = db.Column(db.DateTime)
    # EDITABLE: slug URL du profil public — généré depuis le nom à la création
    slug                    = db.Column(db.String(100), unique=True, nullable=True)

    questionnaires = db.relationship('Questionnaire', backref='author', lazy=True)

    def to_dict(self):
        return {
            'id':                      self.id,
            'email':                   self.email,
            'name':                    self.name,
            'avatar_url':              self.avatar_url,
            'school_id':               self.school_id,
            'university_id':           self.university_id,
            'level':                   self.level,
            'domains':                 self.domains,
            'points':                  self.points or 0,
            'badge_level':             self.badge_level,
            'monthly_responses_given': self.monthly_responses_given or 0,
            'total_responses_given':   self.total_responses_given or 0,
            'total_forms_posted':      self.total_forms_posted or 0,
            'is_founder':              self.is_founder,
            'onboarding_complete':     self.onboarding_complete,
            'slug':                    self.slug,
            'streak':                  self.streak or 0,
            'last_login_date':         self.last_login_date.isoformat() if self.last_login_date else None,
        }


class Questionnaire(db.Model):
    __tablename__ = 'questionnaires'

    id               = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title            = db.Column(db.String(300), nullable=False)
    description      = db.Column(db.Text)
    google_forms_url = db.Column(db.String(500), nullable=False)
    form_id          = db.Column(db.String(200))
    image_url        = db.Column(db.String(500))
    domain           = db.Column(db.String(100))
    target_level     = db.Column(db.String(50))
    target_count     = db.Column(db.Integer, default=100)
    author_id        = db.Column(db.String(36), db.ForeignKey('users.id'))
    school_id        = db.Column(db.String(50))
    university_id    = db.Column(db.String(10))
    response_count   = db.Column(db.Integer, default=0)
    completion_rate  = db.Column(db.Float, default=0.0)
    is_active        = db.Column(db.Boolean, default=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    responses = db.relationship('Response', backref='questionnaire', lazy=True)

    def to_dict(self, author=None):
        return {
            'id':               self.id,
            'title':            self.title,
            'description':      self.description,
            'google_forms_url': self.google_forms_url,
            'form_id':          self.form_id,
            'domain':           self.domain,
            'target_level':     self.target_level,
            'target_count':     self.target_count,
            'author_id':        self.author_id,
            'author_name':      author.name if author else None,
            'author_avatar':    author.avatar_url if author else None,
            'author_school':    author.school_id if author else None,
            'author_slug':      author.slug if author else None,
            'school_id':        self.school_id,
            'university_id':    self.university_id,
            'response_count':   self.response_count,
            'completion_rate':  self.completion_rate,
            'is_active':        self.is_active,
            'is_demo':          self.author_id == 'system-sciconnect-demo',
            'image_url':        self.image_url,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


class Response(db.Model):
    __tablename__ = 'responses'

    id                    = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    questionnaire_id      = db.Column(db.String(36), db.ForeignKey('questionnaires.id'))
    respondent_id         = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    respondent_google_id  = db.Column(db.String(100))
    respondent_email      = db.Column(db.String(200))
    respondent_type       = db.Column(db.String(20))   # verified / public / anonymous
    is_complete           = db.Column(db.Boolean, default=False)
    completion_percentage = db.Column(db.Float, default=0.0)
    validated_by_emitter  = db.Column(db.Boolean, default=True)
    ignored_by_emitter    = db.Column(db.Boolean, default=False)
    # V3: durée et détection suspects
    duration_seconds      = db.Column(db.Integer, nullable=True)
    is_suspect            = db.Column(db.Boolean, default=False)
    created_at            = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                    self.id,
            'questionnaire_id':      self.questionnaire_id,
            'respondent_email':      self.respondent_email,
            'respondent_type':       self.respondent_type,
            'is_complete':           self.is_complete,
            'completion_percentage': self.completion_percentage,
            'validated_by_emitter':  self.validated_by_emitter,
            'ignored_by_emitter':    self.ignored_by_emitter,
            'duration_seconds':      self.duration_seconds,
            'is_suspect':            self.is_suspect or False,
            'created_at':            self.created_at.isoformat() if self.created_at else None,
        }


# V3: Abonnements entre utilisateurs
class Subscription(db.Model):
    __tablename__ = 'subscriptions'

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    subscriber_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    publisher_id  = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    notify_email  = db.Column(db.Boolean, default=True)
    notify_inapp  = db.Column(db.Boolean, default=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('subscriber_id', 'publisher_id', name='uq_subscription'),)
