#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

class DiaryAPITester:
    def __init__(self, base_url="http://localhost:3001"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                except:
                    print(f"   Response: {response.text}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_diary_post_valid(self):
        """Test POST /api/diary with valid data"""
        diary_data = {
            "tripId": "trip-1",
            "dayNumber": 1,
            "date": "2026-03-22",
            "mood": "happy",
            "energyScore": 4,
            "paceScore": 3,
            "freeTextSummary": "Great day exploring Barcelona!",
            "wouldRepeat": True,
            "conversation": [
                {
                    "id": "greeting",
                    "role": "assistant",
                    "content": "¡Hola! ¿Cómo ha ido el Día 1?"
                },
                {
                    "id": "user-mood",
                    "role": "user", 
                    "content": "😊 Estoy feliz"
                }
            ],
            "activityFeedback": [
                {
                    "activityId": "a1",
                    "liked": True,
                    "wouldRepeat": True,
                    "notes": "Hotel was great!"
                },
                {
                    "activityId": "a2", 
                    "liked": True,
                    "wouldRepeat": True,
                    "notes": "Beautiful beach walk"
                }
            ]
        }
        
        return self.run_test(
            "POST /api/diary - Valid Data",
            "POST",
            "api/diary",
            200,
            data=diary_data
        )

    def test_diary_post_missing_fields(self):
        """Test POST /api/diary with missing required fields"""
        incomplete_data = {
            "mood": "happy",
            "energyScore": 4
            # Missing tripId, dayNumber, date
        }
        
        return self.run_test(
            "POST /api/diary - Missing Required Fields",
            "POST", 
            "api/diary",
            400,
            data=incomplete_data
        )

    def test_diary_get_valid(self):
        """Test GET /api/diary with valid params"""
        params = {
            "tripId": "trip-1",
            "dayNumber": "1"
        }
        
        return self.run_test(
            "GET /api/diary - Valid Params",
            "GET",
            "api/diary",
            200,
            data=params
        )

    def test_diary_get_missing_params(self):
        """Test GET /api/diary with missing params"""
        return self.run_test(
            "GET /api/diary - Missing Params",
            "GET",
            "api/diary", 
            400,
            data={}
        )

def main():
    print("🚀 Starting Viaje360 Diary API Tests")
    print("=" * 50)
    
    tester = DiaryAPITester()
    
    # Test POST endpoint
    tester.test_diary_post_valid()
    tester.test_diary_post_missing_fields()
    
    # Test GET endpoint  
    tester.test_diary_get_valid()
    tester.test_diary_get_missing_params()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())