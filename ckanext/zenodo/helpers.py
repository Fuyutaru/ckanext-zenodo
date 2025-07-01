import ckan.plugins.toolkit as toolkit

def get_zenodo_token():
    return toolkit.config.get('ckanext.zenodo.token', '')

def get_ckan_token():
    return toolkit.config.get('ckanext.zenodo.ckanToken', '')