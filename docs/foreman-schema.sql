--
-- PostgreSQL database dump
--

\restrict T9mAzUlKGOrVZYDURTr9d3xG7qJVb5HX30er9tYTQjIsNjhpt3JmNjAcs2h4pcM



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE IF EXISTS foreman;
--
-- Name: foreman; Type: DATABASE; Schema: -; Owner: -
--

CREATE DATABASE foreman WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


\unrestrict T9mAzUlKGOrVZYDURTr9d3xG7qJVb5HX30er9tYTQjIsNjhpt3JmNjAcs2h4pcM
\connect foreman
\restrict T9mAzUlKGOrVZYDURTr9d3xG7qJVb5HX30er9tYTQjIsNjhpt3JmNjAcs2h4pcM

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_table_access_method = heap;

--
-- Name: knex_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Dependencies: 215
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_id_seq OWNED BY public.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Dependencies: 217
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNED BY public.knex_migrations_lock.index;


--
-- Name: run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run (
    id uuid NOT NULL,
    org_id character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    input_data jsonb NOT NULL,
    output_data jsonb,
    error_data jsonb,
    metadata jsonb,
    total_tasks integer NOT NULL,
    completed_tasks integer NOT NULL,
    failed_tasks integer NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    started_at bigint,
    completed_at bigint,
    duration_ms bigint
);


--
-- Name: run_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.run_data (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    task_id uuid NOT NULL,
    org_id character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    value jsonb NOT NULL,
    metadata jsonb,
    tags text[] NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
);


--
-- Name: task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    parent_task_id uuid,
    org_id character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    status character varying(50) NOT NULL,
    input_data jsonb NOT NULL,
    output_data jsonb,
    error_data jsonb,
    metadata jsonb,
    retry_count integer NOT NULL,
    max_retries integer NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    queued_at bigint,
    started_at bigint,
    completed_at bigint,
    duration_ms bigint,
    queue_job_id character varying(255)
);


--
-- Name: knex_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.knex_migrations_lock_index_seq'::regclass);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: run_data run_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_data
    ADD CONSTRAINT run_data_pkey PRIMARY KEY (id);


--
-- Name: run run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run
    ADD CONSTRAINT run_pkey PRIMARY KEY (id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: idx_run_data_key_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_run_data_key_prefix ON public.run_data USING btree (key text_pattern_ops);


--
-- Name: idx_run_data_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_run_data_tags ON public.run_data USING gin (tags);


--
-- Name: run_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_created_at_index ON public.run USING btree (created_at);


--
-- Name: run_data_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_data_created_at_index ON public.run_data USING btree (created_at);


--
-- Name: run_data_key_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_data_key_index ON public.run_data USING btree (key);


--
-- Name: run_data_org_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_data_org_id_index ON public.run_data USING btree (org_id);


--
-- Name: run_data_run_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_data_run_id_index ON public.run_data USING btree (run_id);


--
-- Name: run_data_task_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_data_task_id_index ON public.run_data USING btree (task_id);


--
-- Name: run_org_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_org_id_created_at_index ON public.run USING btree (org_id, created_at);


--
-- Name: run_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX run_status_index ON public.run USING btree (status);


--
-- Name: task_org_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_org_id_created_at_index ON public.task USING btree (org_id, created_at);


--
-- Name: task_parent_task_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_parent_task_id_index ON public.task USING btree (parent_task_id);


--
-- Name: task_queue_job_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_queue_job_id_index ON public.task USING btree (queue_job_id);


--
-- Name: task_run_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_run_id_index ON public.task USING btree (run_id);


--
-- Name: task_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_status_index ON public.task USING btree (status);


--
-- Name: task_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_type_index ON public.task USING btree (type);


--
-- Name: run_data run_data_run_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_data
    ADD CONSTRAINT run_data_run_id_foreign FOREIGN KEY (run_id) REFERENCES public.run(id) ON DELETE CASCADE;


--
-- Name: run_data run_data_task_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.run_data
    ADD CONSTRAINT run_data_task_id_foreign FOREIGN KEY (task_id) REFERENCES public.task(id) ON DELETE CASCADE;


--
-- Name: task task_parent_task_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_parent_task_id_foreign FOREIGN KEY (parent_task_id) REFERENCES public.task(id) ON DELETE CASCADE;


--
-- Name: task task_run_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_run_id_foreign FOREIGN KEY (run_id) REFERENCES public.run(id) ON DELETE CASCADE;


--
-- Dependencies: 219
-- Name: run; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.run ENABLE ROW LEVEL SECURITY;

--
-- Dependencies: 221
-- Name: run_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.run_data ENABLE ROW LEVEL SECURITY;

--
-- Name: run_data run_data_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY run_data_isolation ON public.run_data TO rls_db_user USING (((org_id)::text = current_setting('app.current_org_id'::text, true)));


--
-- Name: run run_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY run_isolation ON public.run TO rls_db_user USING (((org_id)::text = current_setting('app.current_org_id'::text, true)));


--
-- Dependencies: 220
-- Name: task; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task ENABLE ROW LEVEL SECURITY;

--
-- Name: task task_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_isolation ON public.task TO rls_db_user USING (((org_id)::text = current_setting('app.current_org_id'::text, true)));



--
-- PostgreSQL database dump complete
--

\unrestrict T9mAzUlKGOrVZYDURTr9d3xG7qJVb5HX30er9tYTQjIsNjhpt3JmNjAcs2h4pcM

