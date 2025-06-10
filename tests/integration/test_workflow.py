# tests/integration/test_workflow.py
import pytest
import requests
import time
import json
from socketio import Client

BASE_URL = "http://localhost:3000"
CRAWLER_URL = "http://localhost:5000"

class TestResearchWorkflow:
    """Integration tests for the complete research workflow"""
    
    @pytest.fixture
    def socket_client(self):
        client = Client()
        client.connect(BASE_URL)
        yield client
        client.disconnect()
    
    def test_health_endpoints(self):
        """Test all service health endpoints"""
        services = [
            (BASE_URL, "MCP Server"),
            (CRAWLER_URL, "Research Crawler"),
            ("http://localhost:8080", "Code Developer"),
            ("http://localhost:5001", "Document Generator")
        ]
        
        for url, name in services:
            response = requests.get(f"{url}/health")
            assert response.status_code == 200, f"{name} health check failed"
    
    def test_create_session(self, socket_client):
        """Test session creation"""
        session_data = {"topic": "Test research topic"}
        
        session_created = []
        socket_client.on('session:created', lambda data: session_created.append(data))
        
        socket_client.emit('session:create', session_data)
        time.sleep(2)
        
        assert len(session_created) == 1
        assert 'id' in session_created[0]
        assert session_created[0]['topic'] == session_data['topic']
    
    def test_research_flow(self, socket_client):
        """Test basic research flow"""
        # Create session
        session_created = []
        socket_client.on('session:created', lambda data: session_created.append(data))
        socket_client.emit('session:create', {"topic": "Machine learning optimization"})
        time.sleep(2)
        
        session_id = session_created[0]['id']
        
        # Start research
        progress_updates = []
        socket_client.on('research:progress', lambda data: progress_updates.append(data))
        
        socket_client.emit('mcp:request', {
            'id': '123',
            'type': 'request',
            'method': 'research.start',
            'params': {
                'sessionId': session_id,
                'topic': 'Machine learning optimization'
            }
        })
        
        time.sleep(5)
        assert len(progress_updates) > 0