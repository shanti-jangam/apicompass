import { DjangoParser } from '../../src/parsers/djangoParser';

describe('DjangoParser', () => {
  let parser: DjangoParser;

  beforeEach(() => {
    parser = new DjangoParser();
  });

  describe('canParse', () => {
    it('should return true for urls.py files', () => {
      const content = `from django.urls import path`;
      expect(parser.canParse('urls.py', content)).toBe(true);
    });

    it('should return true for files with urlpatterns', () => {
      const content = `urlpatterns = [\n    path('admin/', admin.site.urls),\n]`;
      expect(parser.canParse('routes.py', content)).toBe(true);
    });

    it('should return false for .js files', () => {
      const content = `urlpatterns = []`;
      expect(parser.canParse('urls.js', content)).toBe(false);
    });

    it('should return false for .py files without Django patterns', () => {
      const content = `def hello():\n    print("hello")`;
      expect(parser.canParse('views.py', content)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse basic path() calls', () => {
      const content = [
        `from django.urls import path`,
        `from . import views`,
        ``,
        `urlpatterns = [`,
        `    path('users/', views.user_list),`,
        `    path('users/<int:pk>/', views.user_detail),`,
        `]`,
      ].join('\n');

      const result = parser.parse('/project/urls.py', content);

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0]).toMatchObject({
        method: 'ALL',
        path: '/users/',
        lineNumber: 5,
        framework: 'django',
      });
      expect(result.routes[1]).toMatchObject({
        method: 'ALL',
        path: '/users/:pk/',
        lineNumber: 6,
      });
    });

    it('should skip include() calls', () => {
      const content = [
        `from django.urls import path, include`,
        ``,
        `urlpatterns = [`,
        `    path('api/', include('api.urls')),`,
        `    path('users/', views.user_list),`,
        `]`,
      ].join('\n');

      const result = parser.parse('/project/urls.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/users/');
    });

    it('should parse re_path() calls', () => {
      const content = [
        `from django.urls import re_path`,
        ``,
        `urlpatterns = [`,
        `    re_path(r'^articles/(?P<year>[0-9]{4})/$', views.year_archive),`,
        `]`,
      ].join('\n');

      const result = parser.parse('/project/urls.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/articles/:year/');
    });

    it('should normalize Django angle-bracket parameters', () => {
      const content = `    path('items/<str:slug>/', views.item_detail),`;
      const result = parser.parse('/project/urls.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/items/:slug/');
    });

    it('should normalize simple angle-bracket parameters', () => {
      const content = `    path('items/<pk>/', views.item_detail),`;
      const result = parser.parse('/project/urls.py', content);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].path).toBe('/items/:pk/');
    });

    it('should return correct line numbers', () => {
      const content = [
        `from django.urls import path`,
        ``,
        `urlpatterns = [`,
        `    path('first/', views.first),`,
        `    path('second/', views.second),`,
        `    path('third/', views.third),`,
        `]`,
      ].join('\n');

      const result = parser.parse('/project/urls.py', content);

      expect(result.routes).toHaveLength(3);
      expect(result.routes[0].lineNumber).toBe(4);
      expect(result.routes[1].lineNumber).toBe(5);
      expect(result.routes[2].lineNumber).toBe(6);
    });

    it('should return empty routes for non-Django files', () => {
      const content = `def add(a, b):\n    return a + b`;
      const result = parser.parse('/project/utils.py', content);

      expect(result.routes).toHaveLength(0);
    });
  });
});
