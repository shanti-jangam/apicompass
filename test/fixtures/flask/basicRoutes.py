from flask import Flask

app = Flask(__name__)


@app.route('/users')
def get_users():
    return []


@app.route('/users', methods=['POST'])
def create_user():
    return {'id': 1}


@app.route('/users/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def user_detail(id):
    return {'id': id}


@app.route('/health')
def health_check():
    return {'status': 'ok'}
