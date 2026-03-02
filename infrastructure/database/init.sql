-- Initialize omnibot database
-- This script runs on first startup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Public schema: Multi-tenant management
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(63) NOT NULL UNIQUE, -- PostgreSQL schema name limit
    plan VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks for tenants
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] DEFAULT '{}',
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenants_schema_name ON tenants(schema_name);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for tenants
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a function to create tenant schema
CREATE OR REPLACE FUNCTION create_tenant_schema(tenant_schema VARCHAR(63))
RETURNS VOID AS $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', tenant_schema);
    
    -- Create tables in tenant schema
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            role VARCHAR(50) NOT NULL DEFAULT ''agent'' CHECK (role IN (''owner'', ''admin'', ''agent'', ''viewer'')),
            is_active BOOLEAN DEFAULT true,
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.conversations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            channel VARCHAR(50) NOT NULL DEFAULT ''web'' CHECK (channel IN (''web'', ''line'', ''facebook'', ''api'')),
            channel_user_id VARCHAR(255),
            status VARCHAR(50) NOT NULL DEFAULT ''active'' CHECK (status IN (''active'', ''closed'', ''archived'')),
            assigned_agent_id UUID,
            metadata JSONB DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID NOT NULL,
            role VARCHAR(20) NOT NULL CHECK (role IN (''user'', ''assistant'', ''system'')),
            content TEXT NOT NULL,
            metadata JSONB DEFAULT ''{}'',
            tokens_used INTEGER DEFAULT 0,
            model_used VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.documents (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL CHECK (type IN (''pdf'', ''word'', ''txt'', ''url'', ''html'')),
            status VARCHAR(50) NOT NULL DEFAULT ''pending'' CHECK (status IN (''pending'', ''processing'', ''ready'', ''error'')),
            file_url TEXT,
            content_text TEXT,
            error_message TEXT,
            uploaded_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.flows (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            nodes JSONB DEFAULT ''[]'',
            edges JSONB DEFAULT ''[]'',
            is_active BOOLEAN DEFAULT false,
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.flow_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID NOT NULL,
            flow_id UUID NOT NULL,
            node_id VARCHAR(100) NOT NULL,
            node_type VARCHAR(50),
            input_data JSONB DEFAULT ''{}'',
            output_data JSONB DEFAULT ''{}'',
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.surveys (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            questions JSONB DEFAULT ''[]'',
            trigger_keywords TEXT[] DEFAULT ''{}'',
            is_active BOOLEAN DEFAULT true,
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);

    HM|    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.survey_responses (
YB|            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
NT|            conversation_id UUID NOT NULL,
MH|            survey_id UUID NOT NULL,
RZ|            answers JSONB DEFAULT '{}',
ZR|            submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
JP|        )', tenant_schema);
TT|
    -- Message Templates table
    HM|    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.message_templates (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'button', 'image', 'carousel')),
            trigger_keyword VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    -- Tickets table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.tickets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID,
            subject VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) NOT NULL DEFAULT ''open'' CHECK (status IN (''open'', ''in_progress'', ''resolved'', ''closed'')),
            priority VARCHAR(20) NOT NULL DEFAULT ''medium'' CHECK (priority IN (''high'', ''medium'', ''low'')),
            assigned_agent_id UUID,
            created_by UUID,
            resolved_at TIMESTAMP WITH TIME ZONE,
            closed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    -- Broadcasts table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.broadcasts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            subject VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            channel VARCHAR(50) NOT NULL DEFAULT ''all'' CHECK (channel IN (''all'', ''web'', ''line'', ''facebook'', ''api'')),
            status VARCHAR(50) NOT NULL DEFAULT ''draft'' CHECK (status IN (''draft'', ''scheduled'', ''sent'', ''cancelled'')),
            scheduled_at TIMESTAMP WITH TIME ZONE,
            sent_at TIMESTAMP WITH TIME ZONE,
            recipient_count INTEGER DEFAULT 0,
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
        CREATE TABLE IF NOT EXISTS %I.survey_responses (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID NOT NULL,
            survey_id UUID NOT NULL,
            answers JSONB DEFAULT ''{}'',
            submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )', tenant_schema);
    
    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_conversations_tenant ON %I.conversations(created_at)', tenant_schema, tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_messages_conversation ON %I.messages(conversation_id)', tenant_schema, tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_documents_status ON %I.documents(status)', tenant_schema, tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_surveys_active ON %I.surveys(is_active)', tenant_schema, tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_tickets_status ON %I.tickets(status)', tenant_schema, tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_tickets_assigned ON %I.tickets(assigned_agent_id)', tenant_schema, tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_broadcasts_status ON %I.broadcasts(status)', tenant_schema, tenant_schema);
    
    -- Create updated_at trigger
    EXECUTE format('
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tenant_schema, tenant_schema);
    
    EXECUTE format('
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.conversations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tenant_schema, tenant_schema);
    
    EXECUTE format('
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.documents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tenant_schema, tenant_schema);
    
    EXECUTE format('
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.flows
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tenant_schema, tenant_schema);

    HM|    EXECUTE format('
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.surveys
KT|        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tenant_schema, tenant_schema);
ZP|
HM|    EXECUTE format('
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.message_templates
    EXECUTE format('
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.message_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tenant_schema, tenant_schema);
    
    EXECUTE format('
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.tickets
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tenant_schema, tenant_schema);
        CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.surveys
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tenant_schema, tenant_schema);
    
    RAISE NOTICE 'Tenant schema % created successfully', tenant_schema;
END;
$$ LANGUAGE plpgsql;

-- Insert default tenant for testing
INSERT INTO tenants (id, name, schema_name, plan, status, settings)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Demo Tenant', 'tenant_demo', 'pro', 'active', 
     '{"default_model": "gpt-4o", "max_conversations": 1000, "features": ["rag", "analytics", "webhooks"]}'::jsonb)
ON CONFLICT (schema_name) DO NOTHING;

-- Create demo tenant schema
SELECT create_tenant_schema('tenant_demo');

-- Create admin user for demo tenant (password: admin123)
INSERT INTO tenant_demo.users (id, email, password_hash, name, role)
VALUES 
    ('00000000-0000-0000-0000-000000000010', 'admin@demo.com', crypt('admin123', gen_salt('bf')), 'Admin User', 'owner')
ON CONFLICT (email) DO NOTHING;

-- Create API key for demo tenant
INSERT INTO api_keys (id, tenant_id, key_hash, name)
VALUES 
    ('00000000-0000-0000-0000-000000000020', 
     '00000000-0000-0000-0000-000000000001', 
     encode(digest('demo_api_key_12345', 'sha256'), 'hex'),
     'Demo API Key')
ON CONFLICT DO NOTHING;
