// frontend/src/pages/ViewTripPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styled from "styled-components";
import { MapPin, CalendarDays, Eye, Clock, Bed, DollarSign, FileText, Camera, Lightbulb } from "lucide-react";

type TripDay = {
  id: number;
  day_index: number;
  date: string | null;
  items: ItineraryItem[];
};

type ItineraryItem = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
};

type ViewTripData = {
  id: number;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  owner: {
    name: string;
  };
  days: TripDay[];
  is_view_only: boolean;
};

type ActiveTab = 'itinerary' | 'notes' | 'budget' | 'media' | 'recommendations';

/* ============================
   Styled Components
============================= */

const PageContainer = styled.div`
  min-height: 100vh;
  background: #f8fafb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
`;

const ViewOnlyBanner = styled.div`
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-bottom: 2px solid #f59e0b;
  padding: 0.75rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: #92400e;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const Header = styled.div`
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1.25rem 2rem;
`;

const HeaderContent = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.5rem;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
`;

const Avatar = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.1rem;
  flex-shrink: 0;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
`;

const TripInfo = styled.div`
  flex: 1;
`;

const TripTitle = styled.h1`
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #111827;
`;

const BookButton = styled.button`
  border-radius: 999px;
  padding: 0.65rem 1.2rem;
  border: 1px solid #10b981;
  background: #ecfdf3;
  color: #065f46;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: default;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const MainContainer = styled.div`
  display: flex;
  height: calc(100vh - 140px);
  max-width: 1600px;
  margin: 0 auto;
  gap: 1.5rem;
  padding: 1.5rem;

  @media (max-width: 1024px) {
    flex-direction: column;
    height: auto;
  }
`;

const MapSection = styled.div`
  flex: 0 0 35%;
  background: white;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  position: relative;
  min-height: 500px;

  @media (max-width: 1024px) {
    flex: none;
    height: 400px;
  }
`;

const MapPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    animation: pulse 4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.1); opacity: 0.5; }
  }
`;

const MapIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  animation: float 3s ease-in-out infinite;

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
`;

const MapText = styled.div`
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  z-index: 1;
`;

const MapSubtext = styled.div`
  font-size: 0.95rem;
  opacity: 0.9;
  z-index: 1;
`;

const ContentSection = styled.div`
  flex: 1;
  background: white;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const TabsBar = styled.div`
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  background: #fafbfc;
  padding: 0 1.5rem;
  overflow-x: auto;
`;

const Tab = styled.div<{ $active?: boolean }>`
  padding: 1rem 1.2rem;
  font-size: 0.9rem;
  font-weight: ${(p) => (p.$active ? 650 : 500)};
  color: ${(p) => (p.$active ? "#1f2937" : "#6b7280")};
  border-bottom: 3px solid ${(p) => (p.$active ? "#3730a3" : "transparent")};
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  top: 1px;
  transition: all 0.2s ease;

  &:hover {
    color: #1f2937;
    background: ${(p) => (p.$active ? 'transparent' : '#f3f4f6')};
  }
`;

const TabContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const ContentHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: 1.3rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
`;

const DayCard = styled.div`
  margin-bottom: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: white;
`;

const DayHeader = styled.div`
  background: linear-gradient(135deg, #fafbfc 0%, #fff 100%);
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
`;

const DayTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const ItemsList = styled.div`
  padding: 0;
`;

const ItemCard = styled.div`
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f9fafb;
  }
`;

const ItemNumber = styled.div`
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 650;
  color: #6b7280;
  margin-top: 2px;
`;

const ItemImage = styled.div`
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
`;

const ItemTitle = styled.h4`
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  color: #111827;
  line-height: 1.3;
`;

const ItemMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const ItemTime = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 500;
`;

const ItemLocation = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: #6b7280;
`;

const EmptyTabContent = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: #9ca3af;
`;

const EmptyIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #6b7280;
`;

const EmptyText = styled.p`
  margin: 0;
  font-size: 0.95rem;
  color: #9ca3af;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1rem;
`;

const LoadingSpinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const ErrorContainer = styled.div`
  max-width: 600px;
  margin: 4rem auto;
  background: white;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  border: 1px solid #e5e7eb;
`;

const ErrorTitle = styled.h2`
  margin: 0 0 1rem 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: #dc2626;
`;

const ErrorMessage = styled.p`
  margin: 0;
  font-size: 1.1rem;
  color: #6b7280;
  line-height: 1.6;
`;

/* ============================
   Main Component
============================= */

export default function ViewTripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [tripData, setTripData] = useState<ViewTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('itinerary');

  useEffect(() => {
    if (!tripId) return;

    const fetchTripData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/trip/${tripId}/view/`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Trip not found");
          }
          throw new Error(`Failed to load trip (Status: ${response.status})`);
        }

        const data = await response.json();
        setTripData(data);
      } catch (err) {
        console.error("Error fetching trip:", err);
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, [tripId]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Date not set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return null;
    
    try {
      // Handle different time formats
      let dateObj: Date;
      
      if (timeString.includes('T')) {
        // Full ISO datetime
        dateObj = new Date(timeString);
      } else if (timeString.includes(':')) {
        // Time only (HH:MM or HH:MM:SS)
        dateObj = new Date(`2000-01-01T${timeString}`);
      } else {
        return timeString;
      }

      if (isNaN(dateObj.getTime())) {
        return timeString;
      }

      return dateObj.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const nights = days - 1;
    return `${days} DAYS - ${nights} NIGHTS`;
  };

  const formatBudget = (amount: number = 90000) => {
    return amount.toLocaleString();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'itinerary':
        return (
          <>
            <ContentHeader>
              <SectionTitle>Itinerary Planner</SectionTitle>
            </ContentHeader>

            {tripData && tripData.days.length === 0 ? (
              <EmptyTabContent>
                <EmptyIcon>📅</EmptyIcon>
                <EmptyText>
                  This trip doesn't have any planned activities yet.
                </EmptyText>
              </EmptyTabContent>
            ) : (
              tripData?.days.map((day) => (
                <DayCard key={day.id}>
                  <DayHeader>
                    <DayTitle>
                      DAY {day.day_index} {formatDate(day.date)}
                    </DayTitle>
                  </DayHeader>

                  {day.items.length === 0 ? (
                    <EmptyTabContent>
                      <EmptyText>No activities planned for this day</EmptyText>
                    </EmptyTabContent>
                  ) : (
                    <ItemsList>
                      {day.items.map((item, index) => (
                        <ItemCard key={item.id}>
                          <ItemNumber>{index + 1}</ItemNumber>
                          
                          <ItemImage />

                          <ItemContent>
                            <ItemHeader>
                              <ItemTitle>{item.title}</ItemTitle>
                            </ItemHeader>

                            <ItemMeta>
                              {(item.start_time || item.end_time) && (
                                <ItemTime>
                                  {item.start_time && formatTime(item.start_time)}
                                  {item.start_time && item.end_time && " – "}
                                  {item.end_time && formatTime(item.end_time)}
                                </ItemTime>
                              )}

                              {item.location && (
                                <ItemLocation>
                                  <MapPin size={13} strokeWidth={2} />
                                  {item.location}
                                </ItemLocation>
                              )}
                            </ItemMeta>
                          </ItemContent>
                        </ItemCard>
                      ))}
                    </ItemsList>
                  )}
                </DayCard>
              ))
            )}
          </>
        );

      case 'notes':
        return (
          <EmptyTabContent>
            <EmptyIcon><FileText size={48} strokeWidth={1.5} /></EmptyIcon>
            <EmptyTitle>Notes & Checklists</EmptyTitle>
            <EmptyText>
              Notes and checklists are not available in view-only mode.
            </EmptyText>
          </EmptyTabContent>
        );

      case 'budget':
        return (
          <EmptyTabContent>
            <EmptyIcon><DollarSign size={48} strokeWidth={1.5} /></EmptyIcon>
            <EmptyTitle>Budget</EmptyTitle>
            <EmptyText>
              Budget details are not available in view-only mode.
            </EmptyText>
          </EmptyTabContent>
        );

      case 'media':
        return (
          <EmptyTabContent>
            <EmptyIcon><Camera size={48} strokeWidth={1.5} /></EmptyIcon>
            <EmptyTitle>Media Highlights</EmptyTitle>
            <EmptyText>
              Media highlights are not available in view-only mode.
            </EmptyText>
          </EmptyTabContent>
        );

      case 'recommendations':
        return (
          <EmptyTabContent>
            <EmptyIcon><Lightbulb size={48} strokeWidth={1.5} /></EmptyIcon>
            <EmptyTitle>Recommendations</EmptyTitle>
            <EmptyText>
              Recommendations are not available in view-only mode.
            </EmptyText>
          </EmptyTabContent>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <LoadingContainer>
          <LoadingSpinner />
          <p style={{ fontSize: "1.05rem", fontWeight: 500, color: "#6b7280" }}>
            Loading trip...
          </p>
        </LoadingContainer>
      </PageContainer>
    );
  }

  if (error || !tripData) {
    return (
      <PageContainer>
        <ErrorContainer>
          <ErrorTitle>Oops! {error || "Trip not found"}</ErrorTitle>
          <ErrorMessage>
            {error === "Trip not found"
              ? "This trip doesn't exist or has been removed."
              : "We couldn't load this trip. Please try again later."}
          </ErrorMessage>
        </ErrorContainer>
      </PageContainer>
    );
  }

  const duration = calculateDuration(tripData.start_date, tripData.end_date);
  const ownerInitial = tripData.owner?.name?.charAt(0)?.toUpperCase() || "P";

  return (
    <PageContainer>
      <ViewOnlyBanner>
        <Eye size={16} strokeWidth={2.5} />
        <span>View-Only Mode — You're viewing a shared trip itinerary</span>
      </ViewOnlyBanner>

      <Header>
        <HeaderContent>
          <LeftSection>
            <Avatar>{ownerInitial}</Avatar>
            
            <TripInfo>
              <TripTitle>{tripData.title}</TripTitle>
              
              <StatsRow>
                {duration && (
                  <StatItem>
                    <StatLabel>Duration</StatLabel>
                    <StatValue>
                      <CalendarDays size={14} strokeWidth={2.2} />
                      <span>{duration}</span>
                    </StatValue>
                  </StatItem>
                )}

                <StatItem>
                  <StatLabel>Budget</StatLabel>
                  <StatValue>
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>$</span>
                    <span>{formatBudget()}</span>
                  </StatValue>
                </StatItem>
              </StatsRow>
            </TripInfo>
          </LeftSection>

          <BookButton>
            <Bed size={16} strokeWidth={2} />
            Book hotels
          </BookButton>
        </HeaderContent>
      </Header>

      <MainContainer>
        <MapSection>
          <MapPlaceholder>
            <MapIcon>📍</MapIcon>
            <MapText>{tripData.destination || "Map View"}</MapText>
            <MapSubtext>Interactive map view</MapSubtext>
          </MapPlaceholder>
        </MapSection>

        <ContentSection>
          <TabsBar>
            <Tab $active={activeTab === 'itinerary'} onClick={() => setActiveTab('itinerary')}>
              Itinerary
            </Tab>
            <Tab $active={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>
              Notes & Checklists
            </Tab>
            <Tab $active={activeTab === 'budget'} onClick={() => setActiveTab('budget')}>
              Budget
            </Tab>
            <Tab $active={activeTab === 'media'} onClick={() => setActiveTab('media')}>
              Media Highlights
            </Tab>
            <Tab $active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')}>
              Recommendations
            </Tab>
          </TabsBar>

          <TabContent>
            {renderTabContent()}
          </TabContent>
        </ContentSection>
      </MainContainer>
    </PageContainer>
  );
}
