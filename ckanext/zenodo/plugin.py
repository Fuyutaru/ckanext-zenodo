from ckan.common import CKANConfig
import ckan.plugins as plugins
import ckan.plugins.toolkit as toolkit
import json
import os

# import ckanext.zenodo.cli as cli
import ckanext.zenodo.helpers as helpers
# import ckanext.zenodo.views as views
# from ckanext.zenodo.logic import (
#     action, auth, validators
# )
from ckan.plugins.toolkit import DefaultDatasetForm, get_validator

class ZenodoPlugin(plugins.SingletonPlugin, toolkit.DefaultDatasetForm):
    plugins.implements(plugins.IConfigurer)
    plugins.implements(plugins.ITemplateHelpers)
    plugins.implements(plugins.IDatasetForm, inherit=True)

    def update_config(self, config: CKANConfig):
        toolkit.add_template_directory(config, "templates")
        toolkit.add_public_directory(config, "public")
        toolkit.add_resource("assets", "zenodo")


    def get_helpers(self):
        return {
            'get_zenodo_token': helpers.get_zenodo_token,
            'get_ckan_token': helpers.get_ckan_token,
            'get_resource_types': self.get_resource_types,
            'get_contributor_roles': self.get_contributor_roles,
            'get_date_types': self.get_date_types,
        }

    def get_resource_types(self):
        resource_types_path = os.path.join(os.path.dirname(__file__), 'config', 'resource_types.json')
        with open(resource_types_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def get_contributor_roles(self):
        contributor_roles_path = os.path.join(os.path.dirname(__file__), 'config', 'contributor_roles.json')
        with open(contributor_roles_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def get_date_types(self):
        date_type_path = os.path.join(os.path.dirname(__file__), 'config', 'date_type.json')
        with open(date_type_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def is_fallback(self):
        return True

    def package_types(self):
        return []

    # Internal method to strip email validation
    def _remove_email_validation(self, schema):
        schema['author_email'] = [get_validator('ignore_missing')]
        return schema

    def create_package_schema(self):
        schema = super(ZenodoPlugin, self).create_package_schema()
        return self._remove_email_validation(schema)

    def update_package_schema(self):
        schema = super(ZenodoPlugin, self).update_package_schema()
        return self._remove_email_validation(schema)

    def show_package_schema(self):
        schema = super(ZenodoPlugin, self).show_package_schema()
        return self._remove_email_validation(schema)



