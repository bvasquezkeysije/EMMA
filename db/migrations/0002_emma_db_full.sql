--
-- PostgreSQL database dump
--

\restrict yqeYMcSaZn26ugrehsMM2F1pkYHLcFH6QDGQcYAUo0nCji2O7ULEsqPiNsJXTDM

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE IF EXISTS "emma-db";
--
-- Name: emma-db; Type: DATABASE; Schema: -; Owner: -
--

CREATE DATABASE "emma-db" WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'Spanish_Spain.1252';


\unrestrict yqeYMcSaZn26ugrehsMM2F1pkYHLcFH6QDGQcYAUo0nCji2O7ULEsqPiNsJXTDM
\encoding SQL_ASCII
\connect -reuse-previous=on "dbname='emma-db'"
\restrict yqeYMcSaZn26ugrehsMM2F1pkYHLcFH6QDGQcYAUo0nCji2O7ULEsqPiNsJXTDM

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: dataset_audios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dataset_audios (
    id bigint NOT NULL,
    dataset_id bigint NOT NULL,
    stored_name character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dataset_audios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dataset_audios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dataset_audios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dataset_audios_id_seq OWNED BY public.dataset_audios.id;


--
-- Name: datasets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.datasets (
    id bigint NOT NULL,
    nombre character varying(180) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    codigo character varying(40),
    creador_user_id bigint
);


--
-- Name: datasets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.datasets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: datasets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.datasets_id_seq OWNED BY public.datasets.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id bigint NOT NULL,
    code character varying(120) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id bigint NOT NULL,
    permission_id bigint NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id bigint NOT NULL,
    name character varying(80) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: storage_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storage_assets (
    id uuid NOT NULL,
    original_name text NOT NULL,
    stored_name text NOT NULL,
    disk_path text NOT NULL,
    size_bytes bigint NOT NULL,
    content_type character varying(255) DEFAULT 'application/octet-stream'::character varying NOT NULL,
    category character varying(80) DEFAULT 'general'::character varying NOT NULL,
    uploaded_by character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT storage_assets_size_bytes_check CHECK ((size_bytes >= 0))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id bigint NOT NULL,
    role_id bigint NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255),
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: dataset_audios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dataset_audios ALTER COLUMN id SET DEFAULT nextval('public.dataset_audios_id_seq'::regclass);


--
-- Name: datasets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets ALTER COLUMN id SET DEFAULT nextval('public.datasets_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
0004_create_dataset_audios_table
\.


--
-- Data for Name: dataset_audios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dataset_audios (id, dataset_id, stored_name, original_name, size_bytes, created_at) FROM stdin;
1	2	5e29c442ade142049867f12935c77720_DE0.wav	DE0.wav	74127404	2026-05-24 20:05:24.14029-05
6	1	9331b10360eb4ae7a3fb80f55ab68193_LG4.wav	LG4.wav	125537148	2026-05-24 20:05:24.218819-05
7	1	cad9ff19effd4103809863ac75570c2d_LG2.wav	LG2.wav	167535916	2026-05-24 20:05:24.220682-05
8	1	ee6e341930b6456b9524e5de10c9af85_LG3.wav	LG3.wav	170451602	2026-05-24 20:05:24.221149-05
9	1	faeb26b376f849b9b33d4e35c434f7ab_LG1.wav	LG1.wav	54553190	2026-05-24 20:05:24.222194-05
10	3	6103e922ad8a49a5824b6ec274613fd5_DS1.wav	DS1.wav	10686506	2026-05-25 02:40:10.440006-05
12	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part000.wav	DG1_part000.wav	1140780	2026-05-25 04:37:11.244537-05
13	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part001.wav	DG1_part001.wav	999468	2026-05-25 04:37:11.254753-05
14	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part002.wav	DG1_part002.wav	990252	2026-05-25 04:37:11.255527-05
15	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part003.wav	DG1_part003.wav	1198124	2026-05-25 04:37:11.255857-05
16	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part004.wav	DG1_part004.wav	343084	2026-05-25 04:37:11.256687-05
17	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part000_part000.wav	DG1_part000_part000.wav	1139244	2026-05-25 04:38:36.450105-05
18	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part001_part000.wav	DG1_part001_part000.wav	996396	2026-05-25 04:38:36.454144-05
19	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part002_part000.wav	DG1_part002_part000.wav	988204	2026-05-25 04:38:36.454722-05
20	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part003_part000.wav	DG1_part003_part000.wav	1195308	2026-05-25 04:38:36.45522-05
21	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part000_part000_part000.wav	DG1_part000_part000_part000.wav	1138988	2026-05-25 05:03:08.630905-05
22	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part001_part000_part000.wav	DG1_part001_part000_part000.wav	996396	2026-05-25 05:03:08.637104-05
23	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part002_part000_part000.wav	DG1_part002_part000_part000.wav	988204	2026-05-25 05:03:08.637631-05
24	4	c89056cd4b2b40549fb3f2b41b9d8053_DG1_part003_part000_part000.wav	DG1_part003_part000_part000.wav	1195052	2026-05-25 05:03:08.638065-05
26	6	3614406567a04ba8b2136107c95174ee_DS1_part000.wav	DS1_part000.wav	1516588	2026-05-25 05:17:21.04344-05
27	6	3614406567a04ba8b2136107c95174ee_DS1_part001.wav	DS1_part001.wav	1479724	2026-05-25 05:17:21.046149-05
28	6	3614406567a04ba8b2136107c95174ee_DS1_part002.wav	DS1_part002.wav	1710124	2026-05-25 05:17:21.046543-05
29	6	3614406567a04ba8b2136107c95174ee_DS1_part003.wav	DS1_part003.wav	1652780	2026-05-25 05:17:21.047259-05
30	6	3614406567a04ba8b2136107c95174ee_DS1_part004.wav	DS1_part004.wav	1506348	2026-05-25 05:17:21.047868-05
31	6	3614406567a04ba8b2136107c95174ee_DS1_part005.wav	DS1_part005.wav	1351724	2026-05-25 05:17:21.048647-05
32	6	3614406567a04ba8b2136107c95174ee_DS1_part006.wav	DS1_part006.wav	789548	2026-05-25 05:17:21.048975-05
\.


--
-- Data for Name: datasets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.datasets (id, nombre, created_at, codigo, creador_user_id) FROM stdin;
1	LordGraund	2026-05-24 01:20:46.466143-05	DS-001	1
2	DetrasDelEnigma	2026-05-24 20:00:29.505844-05	DS-002	1
3	Juanchi	2026-05-25 02:36:09.152668-05	DS-003	1
4	DG	2026-05-25 02:44:44.623364-05	DS-004	1
5	DN	2026-05-25 02:47:29.910068-05	DS-005	1
6	DS	2026-05-25 05:06:42.742904-05	DS-006	1
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permissions (id, code, description, created_at) FROM stdin;
1	dashboard.view	Ver dashboard	2026-05-24 00:38:40.772805-05
2	storage.upload	Subir binarios al storage	2026-05-24 00:38:40.772805-05
3	storage.read	Leer metadata y descargar archivos	2026-05-24 00:38:40.772805-05
4	storage.delete	Eliminar archivos del storage	2026-05-24 00:38:40.772805-05
5	users.manage	Gestionar usuarios, roles y permisos	2026-05-24 00:38:40.772805-05
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_permissions (role_id, permission_id, assigned_at) FROM stdin;
1	1	2026-05-24 00:38:40.772805-05
1	2	2026-05-24 00:38:40.772805-05
1	3	2026-05-24 00:38:40.772805-05
1	4	2026-05-24 00:38:40.772805-05
1	5	2026-05-24 00:38:40.772805-05
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, name, description, is_active, created_at) FROM stdin;
1	admin	Acceso total al sistema	t	2026-05-24 00:38:40.772805-05
\.


--
-- Data for Name: storage_assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.storage_assets (id, original_name, stored_name, disk_path, size_bytes, content_type, category, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (user_id, role_id, assigned_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, email, password_hash, is_active, created_at, updated_at) FROM stdin;
1	admin	\N	local-auth	t	2026-05-24 01:20:46.403501-05	2026-05-24 01:20:46.403501-05
\.


--
-- Name: dataset_audios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dataset_audios_id_seq', 32, true);


--
-- Name: datasets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.datasets_id_seq', 6, true);


--
-- Name: permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permissions_id_seq', 5, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: dataset_audios dataset_audios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dataset_audios
    ADD CONSTRAINT dataset_audios_pkey PRIMARY KEY (id);


--
-- Name: datasets datasets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets
    ADD CONSTRAINT datasets_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: storage_assets storage_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_assets
    ADD CONSTRAINT storage_assets_pkey PRIMARY KEY (id);


--
-- Name: storage_assets storage_assets_stored_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_assets
    ADD CONSTRAINT storage_assets_stored_name_key UNIQUE (stored_name);


--
-- Name: dataset_audios uq_dataset_audios_dataset_stored_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dataset_audios
    ADD CONSTRAINT uq_dataset_audios_dataset_stored_name UNIQUE (dataset_id, stored_name);


--
-- Name: datasets uq_datasets_codigo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets
    ADD CONSTRAINT uq_datasets_codigo UNIQUE (codigo);


--
-- Name: datasets uq_datasets_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets
    ADD CONSTRAINT uq_datasets_nombre UNIQUE (nombre);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_dataset_audios_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dataset_audios_created_at ON public.dataset_audios USING btree (created_at);


--
-- Name: idx_dataset_audios_dataset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dataset_audios_dataset_id ON public.dataset_audios USING btree (dataset_id);


--
-- Name: idx_datasets_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_datasets_codigo ON public.datasets USING btree (codigo);


--
-- Name: idx_datasets_creador_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_datasets_creador_user_id ON public.datasets USING btree (creador_user_id);


--
-- Name: idx_datasets_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_datasets_nombre ON public.datasets USING btree (nombre);


--
-- Name: idx_role_permissions_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree (permission_id);


--
-- Name: idx_storage_assets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_assets_category ON public.storage_assets USING btree (category);


--
-- Name: idx_storage_assets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_assets_created_at ON public.storage_assets USING btree (created_at DESC);


--
-- Name: idx_storage_assets_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_storage_assets_uploaded_by ON public.storage_assets USING btree (uploaded_by);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);


--
-- Name: dataset_audios dataset_audios_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dataset_audios
    ADD CONSTRAINT dataset_audios_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.datasets(id) ON DELETE CASCADE;


--
-- Name: datasets fk_datasets_creador_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.datasets
    ADD CONSTRAINT fk_datasets_creador_user FOREIGN KEY (creador_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: role_permissions fk_role_permissions_permission; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions fk_role_permissions_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles fk_user_roles_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles fk_user_roles_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict yqeYMcSaZn26ugrehsMM2F1pkYHLcFH6QDGQcYAUo0nCji2O7ULEsqPiNsJXTDM

