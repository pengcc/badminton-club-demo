import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { Match } from '../models/Match.js';
import { Content } from '../models/Content.js';
import { MembershipApplication } from '../models/MembershipApplication.js';
import { Notification } from '../models/Notification.js';

dotenv.config();

// Helper function to get database URI based on environment
const getDatabaseUri = () => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'test':
      return process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/badminton-club-demo-test';
    case 'development':
      return process.env.MONGODB_URI_DEVELOPMENT || 'mongodb://localhost:27017/badminton-club-demo-dev';
    default:
      return process.env.MONGODB_URI || 'mongodb://localhost:27017/badminton-club-demo';
  }
};

// Mock data generators
const firstNames = {
  male: ['Max', 'Thomas', 'Michael', 'Andreas', 'Stefan', 'Daniel', 'Alexander', 'Christian', 'Sebastian', 'Matthias', 'David', 'Florian', 'Markus', 'Peter', 'Benjamin', 'Martin', 'Kevin', 'Oliver', 'Tobias', 'Jan', 'Pascal', 'Felix', 'Lukas', 'Simon', 'Patrick', 'Marcel', 'Tim', 'Julian', 'Philipp', 'Nico'],
  female: ['Anna', 'Lisa', 'Sarah', 'Julia', 'Laura', 'Maria', 'Sandra', 'Nicole', 'Stefanie', 'Andrea', 'Katharina', 'Melanie', 'Sabine', 'Daniela', 'Christina', 'Nina', 'Jessica', 'Vanessa', 'Jennifer', 'Michelle', 'Tanja', 'Nadine', 'Simone', 'Claudia', 'Susanne', 'Jasmin', 'Petra', 'Manuela', 'Silke', 'Carmen']
};

const lastNames = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Schmitz', 'Krause', 'Meier', 'Lehmann', 'Schmid', 'Schulze', 'Maier', 'Köhler', 'Herrmann', 'König', 'Walter', 'Mayer', 'Huber', 'Kaiser', 'Fuchs', 'Peters', 'Lang', 'Scholz', 'Möller', 'Weiß', 'Jung', 'Hahn', 'Schubert'];

const cities = ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden', 'Hannover', 'Nuremberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden', 'Gelsenkirchen', 'Mönchengladbach', 'Braunschweig', 'Chemnitz', 'Kiel', 'Aachen'];

const streets = ['Hauptstraße', 'Schulstraße', 'Kirchstraße', 'Bahnhofstraße', 'Gartenstraße', 'Dorfstraße', 'Mühlenstraße', 'Lindenstraße', 'Marktstraße', 'Bergstraße', 'Feldstraße', 'Waldstraße', 'Parkstraße', 'Rosenstraße', 'Sportstraße', 'Vereinsstraße', 'Clubstraße', 'Badmintonstraße', 'Trainingsplatz', 'Spielerweg'];

const positions = ['singles', 'doubles', 'mixed-doubles'];

// Generate random data helpers
const getRandomElement = (array: any[]) => array[Math.floor(Math.random() * array.length)];
const getRandomDate = (start: Date, end: Date) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const getRandomPhone = () => `+4915${Math.floor(Math.random() * 900000000 + 100000000)}`;
const getRandomPostalCode = () => Math.floor(Math.random() * 90000 + 10000).toString();
const getRandomRanking = () => Math.floor(Math.random() * 10) + 1;

// Normalize German characters for email addresses
const normalizeForEmail = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
};

const seedData = async () => {
  try {
    // Connect to MongoDB with environment-specific database
    const dbUri = getDatabaseUri();
    await mongoose.connect(dbUri);
    console.log(`MongoDB connected to: ${dbUri}`);

    // Clear existing data
    await User.deleteMany({});
    await Player.deleteMany({});
    await Team.deleteMany({});
    await Match.deleteMany({});
    await Content.deleteMany({});
    await MembershipApplication.deleteMany({});
    await Notification.deleteMany({});
    console.log('Existing data cleared');

    // Create admin users (allow overrides from env for demo)
    const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@club.dev';
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'admin123';
    const coachEmail = process.env.DEMO_COACH_EMAIL || 'coach@club.dev';
    const coachPassword = process.env.DEMO_COACH_PASSWORD || 'coach123';

    const adminUsers = await User.create([
      {
        email: adminEmail,
        password: adminPassword, // Plain password - will be hashed by pre-save hook
        firstName: 'Admin',
        lastName: 'Manager',
        phone: '+49301234568',
        gender: 'female',
        dateOfBirth: '1980-06-15',
        role: 'admin',
        membershipType: 'regular',
        membershipStatus: 'active',
        address: {
          street: 'Management Ave 15',
          city: 'Berlin',
          postalCode: '10178',
          country: 'Germany'
        },
        isPlayer: true
      },
      {
        email: coachEmail,
        password: coachPassword, // Plain password - will be hashed by pre-save hook
        firstName: 'Head',
        lastName: 'Coach',
        phone: '+49301234569',
        gender: 'male',
        dateOfBirth: '1985-03-22',
        role: 'admin',
        membershipType: 'regular',
        membershipStatus: 'active',
        address: {
          street: 'Training Center 8',
          city: 'Berlin',
          postalCode: '10963',
          country: 'Germany'
        },
        isPlayer: true
      }
    ]);

    // Generate members (plus one fixed demo member)
    const memberData: any[] = [];

    // Add a fixed demo member account for easy login
    memberData.push({
      email: process.env.DEMO_MEMBER_EMAIL || 'member@club.dev',
      password: process.env.DEMO_MEMBER_PASSWORD || 'member123',
      firstName: 'Demo',
      lastName: 'Member',
      phone: getRandomPhone(),
      gender: 'male',
      dateOfBirth: '1995-01-01',
      role: 'member',
      membershipType: 'regular',
      membershipStatus: 'active',
      address: {
        street: 'Demo Straße 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'Germany'
      },
      isPlayer: false
    });

    for (let i = 0; i < 57; i++) {
      const gender = Math.random() > 0.5 ? 'male' : 'female';
      const firstName = getRandomElement(firstNames[gender]);
      const lastName = getRandomElement(lastNames);
      const city = getRandomElement(cities);
      const street = getRandomElement(streets);
      const membershipType = getRandomElement(['regular', 'student']);
      const membershipStatus = i > 50 ? getRandomElement(['active', 'inactive', 'suspended']) : 'active';
      const isPlayer = i < 28; // First 28 will be players (30 total including admins)

      const birthYear = Math.floor(Math.random() * 40) + 1970; // Ages 15-55
      const birthMonth = Math.floor(Math.random() * 12) + 1;
      const birthDay = Math.floor(Math.random() * 28) + 1;

      memberData.push({
        email: `${normalizeForEmail(firstName)}.${normalizeForEmail(lastName)}${i}@club.dev`,
        password: 'member123', // Plain password - will be hashed by pre-save hook
        firstName: firstName,
        lastName: lastName,
        phone: getRandomPhone(),
        gender,
        dateOfBirth: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
        role: 'member',
        membershipType,
        membershipStatus,
        address: {
          street: `${street} ${Math.floor(Math.random() * 200) + 1}`,
          city,
          postalCode: getRandomPostalCode(),
          country: 'Germany'
        },
        isPlayer // Set isPlayer field based on condition from line 141
      });
    }

    const members = await User.create(memberData);
    console.log('Users created successfully');

    // Create Player profiles for users who are players
    const playerUsers = [adminUsers[0], adminUsers[1], ...members.filter(m => m.isPlayer)];
    const playerData = [];

    for (let i = 0; i < playerUsers.length; i++) {
      const user = playerUsers[i];
      const userPositions: string[] = [getRandomElement(positions)];

      // Add additional positions for some players
      if (Math.random() > 0.5) {
        userPositions.push(getRandomElement(positions.filter((p: string) => p !== userPositions[0])));
      }

      playerData.push({
        userId: user._id, // Changed from 'user' to 'userId'
        preferredPositions: userPositions,
        singlesRanking: getRandomRanking(),
        doublesRanking: getRandomRanking(),
        isActivePlayer: user.membershipStatus === 'active',
        teamIds: [] // Will be populated when creating teams
      });
    }

    const players = await Player.create(playerData);
    console.log('Players created successfully');

    // Create teams with match levels
    const competitiveTeams = [];

    // Two specific teams as requested
    competitiveTeams.push({
      name: 'Team 1',
      matchLevel: 'Class C',
      createdById: adminUsers[0]._id // Changed from 'createdBy' to 'createdById'
    });

    competitiveTeams.push({
      name: 'Team 2',
      matchLevel: 'Class F',
      createdById: adminUsers[0]._id // Changed from 'createdBy' to 'createdById'
    });

    // Create only the two specified teams
    const teams = await Team.create([...competitiveTeams]);
    console.log('Teams created successfully');

    // Assign players to teams and update team affiliations
    const teamAssignments = new Map();

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      // All players are eligible for any team since we removed skillLevel
      const eligiblePlayers = players;

      // Randomly assign 6-12 players per team
      const teamSize = Math.min(Math.floor(Math.random() * 7) + 6, 20, eligiblePlayers.length);
      const selectedPlayers = eligiblePlayers.slice(0, teamSize);

      teamAssignments.set((team._id as any).toString(), selectedPlayers);

      // Update player team affiliations
      for (let j = 0; j < selectedPlayers.length; j++) {
        const player = selectedPlayers[j];
        // Player now uses teamIds array
        if (!player.teamIds.includes(team._id as any)) {
          player.teamIds.push(team._id as any);
          await player.save();
        }
      }
    }

    console.log('Team assignments completed');

    // Create match data
    const matches = [];

    // Historical matches (September 2025)
    const historicalDates = [
      new Date('2025-09-07T10:00:00Z'),
      new Date('2025-09-14T14:00:00Z'),
      new Date('2025-09-21T16:00:00Z')
    ];

    const opponents = ['BSV Hamburg', 'TV München Badminton', 'SV Frankfurt 1880'];
    const venues = [
      'Sporthalle TU, Musterstraße 19, 10163 Berlin',
      'PU Sporthalle, Teststraße 16, 11209 Berlin'
    ];

    for (let i = 0; i < 3; i++) {
      matches.push({
        date: historicalDates[i],
        time: '10:00',
        location: getRandomElement(venues),
        homeTeamId: competitiveTeams.length > 0 ? teams[i % competitiveTeams.length]._id : teams[0]._id, // Changed from 'team' to 'homeTeamId'
        awayTeamName: opponents[i], // Changed from 'opponent' to 'awayTeamName'
        status: 'completed',
        lineup: new Map(), // Changed from 'lineupSlots' to 'lineup' Map
        scores: { // Changed from separate homeScore/awayScore to scores object
          homeScore: Math.floor(Math.random() * 5) + 3, // Random score 3-7
          awayScore: Math.floor(Math.random() * 5) + 2  // Random score 2-6
        },
        unavailablePlayers: [], // Add empty unavailablePlayers array
        createdById: adminUsers[0].id // Changed from 'createdBy' to 'createdById'
      });
    }

    // Upcoming matches (October-November 2025)
    const upcomingDates = [
      new Date('2025-10-05T10:00:00Z'),
      new Date('2025-10-12T14:00:00Z'),
      new Date('2025-10-19T16:00:00Z'),
      new Date('2025-11-02T10:00:00Z'),
      new Date('2025-11-16T14:00:00Z'),
      new Date('2025-11-23T16:00:00Z')
    ];

    const upcomingOpponents = [
      'Badminton Club Leipzig',
      'TSV Hannover Badminton',
      'SC Potsdam',
      'Berliner SC',
      'SG Spandau Badminton',
      'VfL Tegel Badminton'
    ];

    for (let i = 0; i < 6; i++) {
      matches.push({
        date: upcomingDates[i],
        time: ['10:00', '14:00', '16:00'][i % 3],
        location: getRandomElement(venues),
        homeTeamId: teams[i % teams.length]._id, // Changed from 'team' to 'homeTeamId'
        awayTeamName: upcomingOpponents[i], // Changed from 'opponent' to 'awayTeamName'
        status: 'scheduled',
        lineup: new Map(), // Changed from 'lineupSlots' to 'lineup' Map
        scores: { // Add scores object (empty for scheduled matches)
          homeScore: 0,
          awayScore: 0
        },
        unavailablePlayers: [], // Add empty unavailablePlayers array
        createdById: adminUsers[i % adminUsers.length]._id // Changed from 'createdBy' to 'createdById'
      });
    }

    await Match.create(matches);
    console.log('Matches created successfully');

    // Create sample membership applications
    const applications = [];

    for (let i = 0; i < 8; i++) {
      const gender = Math.random() > 0.5 ? 'male' : 'female';
      const firstName = getRandomElement(firstNames[gender]);
      const lastName = getRandomElement(lastNames);
      const city = getRandomElement(cities);
      const status = getRandomElement(['pending', 'approved', 'rejected']);

      applications.push({
        personalInfo: {
          firstName,
          lastName,
          email: `${normalizeForEmail(firstName)}.${normalizeForEmail(lastName)}.applicant${i}@example.com`,
          phone: getRandomPhone(),
          dateOfBirth: `${Math.floor(Math.random() * 30) + 1980}-${(Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0')}-${(Math.floor(Math.random() * 28) + 1).toString().padStart(2, '0')}`,
          gender,
          address: {
            street: `${getRandomElement(streets)} ${Math.floor(Math.random() * 100) + 1}`,
            city,
            postalCode: getRandomPostalCode(),
            country: 'Germany'
          }
        },
        membershipType: getRandomElement(['regular', 'student']),
        bankingInfo: {
          accountHolder: `${firstName} ${lastName}`,
          iban: `DE${Math.floor(Math.random() * 90) + 10}${Math.floor(Math.random() * 900000000000000000) + 100000000000000000}`,
          bic: 'DEUTDEFFXXX',
          bankName: 'Deutsche Bank',
          accountHolderAddress: `${getRandomElement(streets)} ${Math.floor(Math.random() * 100) + 1}, ${getRandomPostalCode()} ${city}`
        },
        medicalInfo: {
          hasConditions: Math.random() > 0.8,
          conditions: Math.random() > 0.5 ? 'Knee injury history' : undefined,
          canParticipate: true
        },
        motivation: 'I am passionate about badminton and would like to join your club to improve my skills and meet fellow players.',
        status,
        reviewer: status !== 'pending' ? getRandomElement([adminUsers[0].id, ...adminUsers.map(a => a._id)]) : undefined,
        reviewDate: status !== 'pending' ? getRandomDate(new Date('2025-08-01'), new Date()) : undefined,
        reviewNotes: status === 'rejected' ? 'Capacity currently full' : status === 'approved' ? 'Welcome to the club!' : undefined
      });
    }

    await MembershipApplication.create(applications);
    console.log('Membership applications created successfully');

    // Create content entries
    const contentEntries = [
      // English content
      {
        key: 'home_title',
        value: 'Welcome to DCBEV - German-Chinese Badminton Club',
        language: 'en',
        updatedBy: adminUsers[0].id
      },
      {
        key: 'home_intro',
        value: 'We are a vibrant badminton community founded in 2009, bringing together players of all skill levels. Join our 60+ members for training, competitions, and friendship.',
        language: 'en',
        updatedBy: adminUsers[0].id
      },
      {
        key: 'club_address',
        value: 'Sporthalle TU Berlin\nTempelhofer Ufer 19\n10963 Berlin, Germany',
        language: 'en',
        updatedBy: adminUsers[0].id
      },
      {
        key: 'contact_info',
        value: 'Email: info@club.dev\nPhone: +49 30 12345678\nTraining: Mon/Wed/Fri 18:00-22:00',
        language: 'en',
        updatedBy: adminUsers[0].id
      },
      // German content
      {
        key: 'home_title',
        value: 'Willkommen beim DCBEV - Badminton Demo Club',
        language: 'de',
        updatedBy: adminUsers[0].id
      },
      {
        key: 'home_intro',
        value: 'Wir sind eine lebendige Badminton-Gemeinschaft, die 2009 gegründet wurde und Spieler aller Leistungsklassen zusammenbringt. Schließen Sie sich unseren 60+ Mitgliedern für Training, Wettkampf und Freundschaft an.',
        language: 'de',
        updatedBy: adminUsers[0].id
      },
      // Chinese content
      {
        key: 'home_title',
        value: '欢迎来到DCBEV - 德中羽毛球俱乐部',
        language: 'zh',
        updatedBy: adminUsers[0].id
      },
      {
        key: 'home_intro',
        value: '我们是一个成立于2009年的充满活力的羽毛球社区，聚集了各个水平的球员。加入我们60+名成员，一起训练、比赛和交友。',
        language: 'zh',
        updatedBy: adminUsers[0].id
      }
    ];

    await Content.create(contentEntries);
    console.log('Content created successfully');

    // Create sample notifications
    const notifications = [
      {
        title: 'Welcome to DCBEV!',
        message: 'Thank you for joining our badminton community. Check out our training schedule and upcoming events.',
        type: 'info',
        recipients: [adminUsers[0].id],
        createdBy: adminUsers[0].id,
        isRead: false
      },
      {
        title: 'Upcoming Match Alert',
        message: 'Don\'t forget about the match against BSV Hamburg this weekend. Team meeting at 9:00 AM.',
        type: 'important',
        recipients: teams.length > 0 ? [teams[0]._id] : [],
        createdBy: adminUsers[0]._id,
        isRead: false
      },
      {
        title: 'Training Schedule Update',
        message: 'Training sessions for next week have been moved to the new gym. Check your email for details.',
        type: 'warning',
        recipients: playerUsers.slice(0, 10).map(u => u._id), // Fixed: Use user IDs, not player IDs
        createdBy: adminUsers[1]._id,
        isRead: false
      }
    ];

    await Notification.create(notifications);
    console.log('Notifications created successfully');

    // Final summary
    const stats = {
      users: await User.countDocuments(),
      players: await Player.countDocuments(),
      teams: await Team.countDocuments(),
      matches: await Match.countDocuments(),
      applications: await MembershipApplication.countDocuments(),
      content: await Content.countDocuments(),
      notifications: await Notification.countDocuments()
    };

    console.log('\n=== DATABASE SEEDING COMPLETED ===');
    console.log(`🏠 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Database: ${dbUri}`);
    console.log(`\n✅ Created ${stats.users} users (including 3 admins)`);
    console.log(`✅ Created ${stats.players} player profiles`);
    console.log(`✅ Created ${stats.teams} teams`);
    console.log(`✅ Created ${stats.matches} matches (3 completed, 6 upcoming)`);
    console.log(`✅ Created ${stats.applications} membership applications`);
    console.log(`✅ Created ${stats.content} content entries`);
    console.log(`✅ Created ${stats.notifications} notifications`);

    console.log('\n🎯 Test Accounts:');
    console.log('Admin: admin@club.dev / admin123');
    console.log('Coach: coach@club.dev / coach123');
    console.log('Members: [firstname].[lastname][number]@club.dev / member123');

    console.log('\n📅 Match Schedule:');
    console.log('- 3 completed matches in September 2025');
    console.log('- 6 upcoming matches in October-November 2025');

    console.log('\n🏥 Teams:');
    console.log('- Competition Teams: Advanced/Professional players');
    console.log('- Recreational Teams: All skill levels welcome');
    console.log('- Youth Team: Students and younger members');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}
// Check if script is being run directly
if (process.argv[1] && process.argv[1].includes('seedData.ts')) {
  seedData();
}

export { seedData };