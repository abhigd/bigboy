import json

class User(object):
    '''
    This provides default implementations for the methods that Flask-Login
    expects user objects to have.
    '''
    def __init__(self, redis_client, user_id):
        self.user_id = user_id
        user_info = redis_client.get("user:%s" %(user_id))
        self.user_info = json.loads(user_info)

    def is_active(self):
        return True

    def is_authenticated(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        try:
            return unicode(self.user_id)
        except AttributeError:
            raise NotImplementedError('No `id` attribute - override `get_id`')

    def __eq__(self, other):
        '''
        Checks the equality of two `UserMixin` objects using `get_id`.
        '''
        if isinstance(other, User):
            return self.get_id() == other.get_id()
        return NotImplemented

    def __ne__(self, other):
        '''
        Checks the inequality of two `UserMixin` objects using `get_id`.
        '''
        equal = self.__eq__(other)
        if equal is NotImplemented:
            return NotImplemented
        return not equal

    @staticmethod
    def get(redis_client, user_id):
        user = User(redis_client, user_id)

        return user
