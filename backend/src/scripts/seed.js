const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database seeding script for development data
async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://pbdna_user:pbdna_password@localhost:5432/pbdna_dev'
  });

  try {
    const client = await pool.connect();
    
    // Check if data already exists
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const existingUsers = parseInt(userCount.rows[0].count);
    
    if (existingUsers > 0) {
      console.log(`ℹ️  Database already has ${existingUsers} users. Skipping seeding.`);
      console.log('   Use --force flag to reseed anyway.');
      client.release();
      return;
    }
    
    console.log('📝 Creating sample users...');
    
    // Create sample users for testing
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const sampleUsers = [
      {
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        industry: 'Technology',
        role: 'Product Manager',
        company: 'TechCorp Inc.'
      },
      {
        email: 'sarah.johnson@example.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        industry: 'Marketing',
        role: 'Marketing Director',
        company: 'Growth Solutions'
      },
      {
        email: 'mike.chen@example.com',
        firstName: 'Mike',
        lastName: 'Chen',
        industry: 'Finance',
        role: 'Senior Analyst',
        company: 'Financial Insights LLC'
      }
    ];
    
    const createdUsers = [];
    
    for (const user of sampleUsers) {
      const result = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, industry, role, company, is_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id, email, first_name, last_name
      `, [
        user.email,
        hashedPassword,
        user.firstName,
        user.lastName,
        user.industry,
        user.role,
        user.company
      ]);
      
      createdUsers.push(result.rows[0]);
      console.log(`✅ Created user: ${user.firstName} ${user.lastName} (${user.email})`);
    }
    
    console.log('📝 Creating sample voice profiles...');
    
    // Create sample voice profiles
    const sampleVoiceProfiles = [
      {
        userId: createdUsers[0].id,
        voiceSignature: {
          formality_level: 0.6,
          emotional_expressiveness: 0.7,
          technical_depth: 0.8,
          storytelling_style: 0.5,
          authority_tone: 0.7,
          empathy_level: 0.6,
          humor_usage: 0.3,
          vulnerability_comfort: 0.4,
          industry_jargon: 0.7,
          communication_pace: 0.6,
          explanation_style: 0.8,
          question_asking_tendency: 0.5,
          call_to_action_style: 0.6,
          personal_experience_sharing: 0.5
        },
        confidenceScore: 0.85,
        transcription: 'Sample transcription for demo user showing professional tech communication style.'
      },
      {
        userId: createdUsers[1].id,
        voiceSignature: {
          formality_level: 0.5,
          emotional_expressiveness: 0.8,
          technical_depth: 0.4,
          storytelling_style: 0.8,
          authority_tone: 0.6,
          empathy_level: 0.9,
          humor_usage: 0.6,
          vulnerability_comfort: 0.7,
          industry_jargon: 0.5,
          communication_pace: 0.7,
          explanation_style: 0.6,
          question_asking_tendency: 0.8,
          call_to_action_style: 0.9,
          personal_experience_sharing: 0.8
        },
        confidenceScore: 0.88,
        transcription: 'Sample transcription for marketing professional showing engaging, story-driven communication.'
      }
    ];
    
    for (let i = 0; i < sampleVoiceProfiles.length; i++) {
      const profile = sampleVoiceProfiles[i];
      await client.query(`
        INSERT INTO voice_profiles (user_id, voice_signature, confidence_score, transcription)
        VALUES ($1, $2, $3, $4)
      `, [
        profile.userId,
        JSON.stringify(profile.voiceSignature),
        profile.confidenceScore,
        profile.transcription
      ]);
      
      console.log(`✅ Created voice profile for ${createdUsers[i].first_name} ${createdUsers[i].last_name}`);
    }
    
    console.log('📝 Creating sample content...');
    
    // Create sample generated content
    const sampleContent = [
      {
        userId: createdUsers[0].id,
        content: `🚀 Just shipped a major feature update that I'm really excited about!

After months of user research and iterative development, we've completely reimagined our dashboard experience. The new interface reduces task completion time by 40% and user satisfaction scores have jumped from 3.2 to 4.7.

Key insights from this project:
• User feedback is gold - we interviewed 50+ customers
• Small UX changes can have massive impact
• Cross-functional collaboration makes everything better

The best part? Our support tickets for navigation issues dropped by 60% in the first week.

What's been your biggest product win this year? I'd love to hear about the challenges you overcame to get there.

#ProductManagement #UserExperience #TechLeadership`,
        topic: 'Product feature launch success',
        contentType: 'post',
        status: 'generated'
      },
      {
        userId: createdUsers[1].id,
        content: `💡 Here's something I learned the hard way about B2B marketing...

Last year, we spent $50K on a beautifully designed campaign that fell completely flat. Zero leads. Crickets.

The problem? We were talking about ourselves instead of our customers' pain points.

Fast forward to this quarter: Same budget, completely different approach.

Instead of "Look how amazing our product is," we focused on "Here's how to solve the problem keeping you up at night."

Results:
• 300% increase in qualified leads
• 45% higher conversion rate
• Prospects actually thanked us for the content

The lesson? Stop selling and start helping. Your audience will notice the difference.

What's the best marketing advice you've ever received? Drop it in the comments! 👇

#MarketingStrategy #B2BMarketing #ContentMarketing`,
        topic: 'Marketing strategy lessons learned',
        contentType: 'post',
        status: 'generated'
      }
    ];
    
    for (let i = 0; i < sampleContent.length; i++) {
      const content = sampleContent[i];
      await client.query(`
        INSERT INTO generated_content (user_id, content, topic, content_type, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        content.userId,
        content.content,
        content.topic,
        content.contentType,
        content.status
      ]);
      
      console.log(`✅ Created sample content for ${createdUsers[i].first_name} ${createdUsers[i].last_name}`);
    }
    
    console.log('📝 Creating sample templates...');
    
    // Additional content templates beyond what's in init.sql
    const additionalTemplates = [
      {
        name: 'Team Recognition',
        description: 'Recognize and celebrate team achievements',
        contentType: 'post',
        structure: `👏 Huge shoutout to {{team_member}} for {{achievement}}!

{{impact_description}}

This is exactly the kind of {{value_demonstrated}} that makes our team stronger.

{{specific_example}}

Grateful to work with such talented people who {{team_values}}.

#TeamWork #Recognition #Leadership`,
        variables: {
          team_member: { type: 'string', description: 'Team member being recognized' },
          achievement: { type: 'string', description: 'What they accomplished' },
          impact_description: { type: 'string', description: 'How this impacted the business' },
          value_demonstrated: { type: 'string', description: 'Company value demonstrated' },
          specific_example: { type: 'string', description: 'Specific example of their work' },
          team_values: { type: 'string', description: 'What makes the team special' }
        },
        industryTags: ['leadership', 'management', 'team'],
        useCase: 'team_recognition'
      }
    ];
    
    for (const template of additionalTemplates) {
      await client.query(`
        INSERT INTO content_templates (name, description, content_type, template_structure, variables, industry_tags, use_case)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        template.name,
        template.description,
        template.contentType,
        template.structure,
        JSON.stringify(template.variables),
        template.industryTags,
        template.useCase
      ]);
    }
    
    console.log('✅ Additional templates created');
    
    client.release();
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Created ${createdUsers.length} sample users`);
    console.log(`   • Created ${sampleVoiceProfiles.length} voice profiles`);
    console.log(`   • Created ${sampleContent.length} sample content pieces`);
    console.log(`   • Added ${additionalTemplates.length} additional templates`);
    console.log('\n🔑 Test login credentials:');
    console.log('   Email: demo@example.com');
    console.log('   Password: password123');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ Seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding script failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };