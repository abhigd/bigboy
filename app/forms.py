import time
from email.header import Header

import wtforms
from wtforms.form       import *
from wtforms.validators import *
from wtforms.fields     import *
from wtforms.validators import ValidationError

from wtforms.ext.dateutil.fields import DateTimeField

def acl_check(form, field):
    pass

def epoch_check(form, field):
    try:
        time.gmtime(field.data)
    except:
        raise ValidationError('Not a valid time')
    else:
        if time.time() > int(field.data):
            raise ValidationError('Expiry Date cannot be in the past')

class FileForm(Form):
    title = TextField("", validators=[InputRequired()])
    key = TextField("", validators=[InputRequired()])
    type = TextField("", validators=[Optional()], default=None)
    size = IntegerField("", validators=[InputRequired()])

class NewFileForm(Form):
    key = TextField("", validators=[Optional()], default=None)
    name = TextField("", validators=[Optional()], default="No Name")
    size = IntegerField("", validators=[InputRequired()])
    hash = TextField("", validators=[Optional()], default=None)

class FilePartUploadForm(Form):
    s3_key = TextField("", validators=[InputRequired()])
    mp_id = TextField("", validators=[InputRequired()])
    content_length = IntegerField("", validators=[InputRequired()])
    part_number = IntegerField("", validators=[InputRequired()])
    content_hash = TextField("", validators=[InputRequired()])
    bucket_name = TextField("", validators=[InputRequired()])

class Files(Form):
    start = IntegerField("", validators=[Optional()], default=0)
    end = IntegerField("", validators=[Optional()], default=10)

class LinkForm(Form):
    target = TextField("", validators=[Optional()])
    expires_in = IntegerField("", validators=[InputRequired(),
        NumberRange(min=0)])
    allow_downloads = BooleanField("", validators=[Optional()], default=True)
    allow_uploads = BooleanField("", validators=[Optional()], default=False)
    max_target_downloads = IntegerField("", validators=[Optional()], default=0)
    max_upload_size = IntegerField("", validators=[Optional()], default=1024*1024*100)
    max_uploads = IntegerField("", validators=[Optional()], default=10)

class UploadFileForm(Form):
    pass

class BucketForm(Form):
    is_private = BooleanField("", validators=[Optional()], default=False)
    bucket_size = IntegerField("", validators=[Optional()], default=1*100*1024)
    bucket_file_size = IntegerField("", validators=[Optional()], default=10*1024)
    bucket_expiry_date = DateTimeField("", validators=[Optional()])

class LinkTargetForm(Form):
    target_id = TextField("", validators=[InputRequired()])

class EditLinkTargetForm(Form):
    id = TextField("", validators=[InputRequired()])
    approved = BooleanField("", validators=[Optional()], default=True)
    description = TextField("", validators=[Optional()])
