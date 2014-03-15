from setuptools import setup

setup(
    name='Celery',
    version='1.0',
    long_description=__doc__,
    packages=['app'],
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        'Flask',
        'boto',
        'wtforms',
        'python-dateutil',
        'Flask-login',
        'rfc6266',
        'rauth',
        'rsa',
        'redis',
        'pygeoip']
)
