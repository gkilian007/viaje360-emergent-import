import { successResponse } from "@/lib/api/route-helpers"

// Helper to get test city from query params or default to Barcelona
function getMockDataForCity(city: string) {
  const cities: Record<string, { 
    trip: any
    days: any[]
    chatMessages: any[]
  }> = {
    barcelona: {
      trip: {
        id: "trip-barcelona",
        name: "Barcelona Adventure",
        destination: "Barcelona",
        country: "España",
        startDate: "2026-03-22",
        endDate: "2026-03-25",
        budget: 1500,
        spent: 0,
        status: "active"
      },
      days: [
        {
          date: "2026-03-22",
          dayNumber: 1,
          activities: [
            {
              id: "bcn-a1",
              name: "Check-in Hotel Arts",
              type: "hotel",
              location: "Marina",
              time: "14:00",
              duration: 60,
              cost: 0
            },
            {
              id: "bcn-a2",
              name: "Paseo por la Barceloneta",
              type: "park",
              location: "Beach",
              time: "16:00",
              duration: 90,
              cost: 0
            },
            {
              id: "bcn-a3",
              name: "Cena en El Nacional",
              type: "restaurant",
              location: "Gracia",
              time: "20:30",
              duration: 90,
              cost: 45
            }
          ]
        }
      ],
      chatMessages: []
    },
    madrid: {
      trip: {
        id: "trip-madrid",
        name: "Madrid Escapada",
        destination: "Madrid",
        country: "España",
        startDate: "2026-04-01",
        endDate: "2026-04-04",
        budget: 1200,
        spent: 0,
        status: "active"
      },
      days: [
        {
          date: "2026-04-01",
          dayNumber: 1,
          activities: [
            {
              id: "mad-a1",
              name: "Check-in Hotel Ritz",
              type: "hotel",
              location: "Plaza de la Lealtad",
              time: "14:00",
              duration: 60,
              cost: 0
            },
            {
              id: "mad-a2",
              name: "Visita Museo del Prado",
              type: "museum",
              location: "Paseo del Prado",
              time: "16:00",
              duration: 180,
              cost: 15
            },
            {
              id: "mad-a3",
              name: "Paseo por Retiro",
              type: "park",
              location: "Parque del Retiro",
              time: "20:00",
              duration: 90,
              cost: 0
            }
          ]
        }
      ],
      chatMessages: []
    },
    paris: {
      trip: {
        id: "trip-paris",
        name: "París Romántico",
        destination: "Paris",
        country: "Francia",
        startDate: "2026-05-01",
        endDate: "2026-05-05",
        budget: 2000,
        spent: 0,
        status: "active"
      },
      days: [
        {
          date: "2026-05-01",
          dayNumber: 1,
          activities: [
            {
              id: "par-a1",
              name: "Check-in Hotel Le Marais",
              type: "hotel",
              location: "Le Marais",
              time: "14:00",
              duration: 60,
              cost: 0
            },
            {
              id: "par-a2",
              name: "Tour Eiffel",
              type: "monument",
              location: "Champ de Mars",
              time: "17:00",
              duration: 120,
              cost: 26
            },
            {
              id: "par-a3",
              name: "Cena en Le Comptoir",
              type: "restaurant",
              location: "Saint-Germain",
              time: "20:30",
              duration: 90,
              cost: 65
            }
          ]
        }
      ],
      chatMessages: []
    }
  }

  return cities[city.toLowerCase()] || cities.barcelona
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const city = searchParams.get("city") || "barcelona"
    
    const mockData = getMockDataForCity(city)
    return successResponse(mockData)
  } catch (error) {
    console.error("trips/active error:", error)
    return successResponse({ trip: null, days: [], chatMessages: [] })
  }
}