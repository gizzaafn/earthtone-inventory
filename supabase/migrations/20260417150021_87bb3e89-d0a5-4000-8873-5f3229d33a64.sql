
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'kitchen', 'bar');
CREATE TYPE public.department AS ENUM ('kitchen', 'bar');
CREATE TYPE public.movement_type AS ENUM ('in', 'out');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS public.department
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'kitchen') THEN 'kitchen'::public.department
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'bar') THEN 'bar'::public.department
    ELSE NULL
  END;
$$;

-- ============ INVENTORY_ITEMS ============
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  department public.department NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  unit_price_idr NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_inventory_department ON public.inventory_items(department);

-- ============ STOCK_MOVEMENTS ============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  department public.department NOT NULL,
  movement_type public.movement_type NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_movements_item ON public.stock_movements(item_id);
CREATE INDEX idx_movements_dept ON public.stock_movements(department);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update stock when movement inserted
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE public.inventory_items SET current_stock = current_stock + NEW.quantity WHERE id = NEW.item_id;
  ELSE
    UPDATE public.inventory_items SET current_stock = GREATEST(0, current_stock - NEW.quantity) WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "admin insert profiles" ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- user_roles: only admin can manage; users can read their own
CREATE POLICY "users read own role" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- inventory_items
-- SELECT: admin sees all; kitchen/bar only own dept
CREATE POLICY "view inventory by dept" ON public.inventory_items FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'kitchen') AND department = 'kitchen')
    OR (public.has_role(auth.uid(), 'bar') AND department = 'bar')
  );
CREATE POLICY "insert inventory by dept" ON public.inventory_items FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'kitchen') AND department = 'kitchen')
    OR (public.has_role(auth.uid(), 'bar') AND department = 'bar')
  );
CREATE POLICY "update inventory by dept" ON public.inventory_items FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'kitchen') AND department = 'kitchen')
    OR (public.has_role(auth.uid(), 'bar') AND department = 'bar')
  );
CREATE POLICY "delete inventory by dept" ON public.inventory_items FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'kitchen') AND department = 'kitchen')
    OR (public.has_role(auth.uid(), 'bar') AND department = 'bar')
  );

-- stock_movements
CREATE POLICY "view movements by dept" ON public.stock_movements FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'kitchen') AND department = 'kitchen')
    OR (public.has_role(auth.uid(), 'bar') AND department = 'bar')
  );
CREATE POLICY "insert movements by dept" ON public.stock_movements FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'kitchen') AND department = 'kitchen')
    OR (public.has_role(auth.uid(), 'bar') AND department = 'bar')
  );
