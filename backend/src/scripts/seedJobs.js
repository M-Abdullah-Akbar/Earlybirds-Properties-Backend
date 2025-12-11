require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const Job = require('../models/Job');

const jobsData = [
    {
        title: "Real Estate Agent",
        department: "Sales",
        location: "Dubai",
        type: "Full Time",
        salary: "Commission Based",
        description: "We are looking for an experienced Real Estate Agent to join our growing team. The ideal candidate will have a proven track record in sales and a deep understanding of the Dubai property market.",
        responsibilities: [
            "Generate client leads to buy, sell, and rent property",
            "Counsel clients on market conditions, prices, and mortgages",
            "Develop a competitive market price by comparing properties",
            "Create lists for real estate sale properties, with information location, features, square footage, etc",
            "Show properties to potential buyers and renters",
            "Present purchase offers to sellers",
            "Facilitate negotiations between buyers and sellers"
        ],
        requirements: [
            "Proven working experience as a Real Estate Agent or Real Estate Salesperson",
            "Proven track record of successful sales",
            "Ability to work independently combined with excellent interpersonal skills",
            "Strong sales, negotiation and communication skills",
            "Pleasant and trustworthy",
            "MS Office familiarity"
        ],
        status: "active",
        adminEmail: "info@earlybirdsproperties.com"
    },
    {
        title: "Marketing Specialist",
        department: "Marketing",
        location: "Dubai",
        type: "Full Time",
        salary: "15,000 - 20,000 AED",
        description: "We are seeking a creative Marketing Specialist to lead our marketing initiatives. You will be responsible for creating and executing marketing strategies to promote our properties and brand.",
        responsibilities: [
            "Develop and implement marketing plans",
            "Manage social media accounts",
            "Create engaging content for website and social media",
            "Coordinate with design and sales teams",
            "Analyze market trends and competitors",
            "Organize promotional events"
        ],
        requirements: [
            "Bachelor's degree in Marketing or related field",
            "3+ years of experience in marketing",
            "Strong knowledge of digital marketing tools",
            "Excellent written and verbal communication skills",
            "Creativity and attention to detail"
        ],
        status: "active",
        adminEmail: "marketing@earlybirdsproperties.com"
    },
    {
        title: "Administrative Assistant",
        department: "Administration",
        location: "Abu Dhabi",
        type: "Full Time",
        salary: "8,000 - 10,000 AED",
        description: "We need an organized Administrative Assistant to support our daily operations. You will be responsible for handling clerical tasks and ensuring smooth office workflow.",
        responsibilities: [
            "Handle incoming calls and emails",
            "Schedule appointments and meetings",
            "Maintain filing systems",
            "Prepare reports and presentations",
            "Order office supplies",
            "Greet visitors"
        ],
        requirements: [
            "High school diploma or equivalent",
            "Prior experience as an administrative assistant",
            "Proficiency in MS Office",
            "Excellent organizational skills",
            "Strong communication skills"
        ],
        status: "active",
        adminEmail: "hr@earlybirdsproperties.com"
    },
    {
        title: "Property Consultant",
        department: "Sales",
        location: "Sharjah",
        type: "Contract",
        salary: "Commission Based",
        description: "Join as a Property Consultant to help clients find their ideal properties in Sharjah.",
        responsibilities: [
            "Advise clients on property investment",
            "Conduct property viewings",
            "Negotiate lease and sale terms",
            "Maintain client relationships"
        ],
        requirements: [
            "Knowledge of Sharjah real estate market",
            "Valid driving license",
            "Self-motivated and goal-oriented"
        ],
        status: "active",
        adminEmail: "jobs@earlybirdsproperties.com"
    }
];

const seedJobs = async () => {
    try {
        await mongoose.connect(process.env.DATABASE);
        console.log('MongoDB Connected...');

        // Clear existing jobs
        await Job.deleteMany();
        console.log('Existing jobs cleared.');

        // Insert new jobs
        await Job.insertMany(jobsData);
        console.log('Seed data imported successfully!');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedJobs();
