export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            app_settings: {
                Row: {
                    key: string
                    updated_at: string
                    value: string | null
                }
                Insert: {
                    key: string
                    updated_at?: string
                    value?: string | null
                }
                Update: {
                    key?: string
                    updated_at?: string
                    value?: string | null
                }
                Relationships: []
            }
            products: {
                Row: {
                    active: boolean
                    created_at: string
                    description: string | null
                    id: number
                    name: string
                    tn_metadata: Json | null
                    tn_product_id: number | null
                    updated_at: string
                }
                Insert: {
                    active?: boolean
                    created_at?: string
                    description?: string | null
                    id?: never
                    name: string
                    tn_metadata?: Json | null
                    tn_product_id?: number | null
                    updated_at?: string
                }
                Update: {
                    active?: boolean
                    created_at?: string
                    description?: string | null
                    id?: never
                    name?: string
                    tn_metadata?: Json | null
                    tn_product_id?: number | null
                    updated_at?: string
                }
                Relationships: []
            }
            sale_items: {
                Row: {
                    id: number
                    quantity: number
                    sale_id: number
                    subtotal: number
                    unit_price: number
                    variant_id: number
                    warehouse_id: number
                }
                Insert: {
                    id?: never
                    quantity: number
                    sale_id: number
                    subtotal: number
                    unit_price: number
                    variant_id: number
                    warehouse_id: number
                }
                Update: {
                    id?: never
                    quantity?: number
                    sale_id?: number
                    subtotal?: number
                    unit_price?: number
                    variant_id?: number
                    warehouse_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "sale_items_sale_id_fkey"
                        columns: ["sale_id"]
                        isOneToOne: false
                        referencedRelation: "sales"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sale_items_variant_id_fkey"
                        columns: ["variant_id"]
                        isOneToOne: false
                        referencedRelation: "variants"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sale_items_warehouse_id_fkey"
                        columns: ["warehouse_id"]
                        isOneToOne: false
                        referencedRelation: "warehouses"
                        referencedColumns: ["id"]
                    },
                ]
            }
            sales: {
                Row: {
                    channel: string
                    created_at: string
                    customer_name: string | null
                    id: number
                    notes: string | null
                    payment_method: string
                    sale_number: string
                    sale_type: string
                    status: string
                    total: number
                }
                Insert: {
                    channel?: string
                    created_at?: string
                    customer_name?: string | null
                    id?: never
                    notes?: string | null
                    payment_method?: string
                    sale_number: string
                    sale_type?: string
                    status?: string
                    total?: number
                }
                Update: {
                    channel?: string
                    created_at?: string
                    customer_name?: string | null
                    id?: never
                    notes?: string | null
                    payment_method?: string
                    sale_number?: string
                    sale_type?: string
                    status?: string
                    total?: number
                }
                Relationships: []
            }
            stock_levels: {
                Row: {
                    id: number
                    quantity: number
                    updated_at: string
                    variant_id: number
                    warehouse_id: number
                }
                Insert: {
                    id?: never
                    quantity?: number
                    updated_at?: string
                    variant_id: number
                    warehouse_id: number
                }
                Update: {
                    id?: never
                    quantity?: number
                    updated_at?: string
                    variant_id?: number
                    warehouse_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "stock_levels_variant_id_fkey"
                        columns: ["variant_id"]
                        isOneToOne: false
                        referencedRelation: "variants"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "stock_levels_warehouse_id_fkey"
                        columns: ["warehouse_id"]
                        isOneToOne: false
                        referencedRelation: "warehouses"
                        referencedColumns: ["id"]
                    },
                ]
            }
            stock_movements: {
                Row: {
                    created_at: string
                    id: number
                    movement_type: string
                    notes: string | null
                    quantity: number
                    reference: string | null
                    source_warehouse_id: number | null
                    target_warehouse_id: number | null
                    user_id: string | null
                    variant_id: number
                }
                Insert: {
                    created_at?: string
                    id?: never
                    movement_type: string
                    notes?: string | null
                    quantity: number
                    reference?: string | null
                    source_warehouse_id?: number | null
                    target_warehouse_id?: number | null
                    user_id?: string | null
                    variant_id: number
                }
                Update: {
                    created_at?: string
                    id?: never
                    movement_type?: string
                    notes?: string | null
                    quantity?: number
                    reference?: string | null
                    source_warehouse_id?: number | null
                    target_warehouse_id?: number | null
                    user_id?: string | null
                    variant_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "stock_movements_source_warehouse_id_fkey"
                        columns: ["source_warehouse_id"]
                        isOneToOne: false
                        referencedRelation: "warehouses"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "stock_movements_target_warehouse_id_fkey"
                        columns: ["target_warehouse_id"]
                        isOneToOne: false
                        referencedRelation: "warehouses"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "stock_movements_variant_id_fkey"
                        columns: ["variant_id"]
                        isOneToOne: false
                        referencedRelation: "variants"
                        referencedColumns: ["id"]
                    },
                ]
            }
            sync_log: {
                Row: {
                    created_at: string
                    direction: string
                    error_details: string | null
                    event_type: string
                    id: number
                    payload: Json | null
                    status: string
                }
                Insert: {
                    created_at?: string
                    direction: string
                    error_details?: string | null
                    event_type: string
                    id?: never
                    payload?: Json | null
                    status: string
                }
                Update: {
                    created_at?: string
                    direction?: string
                    error_details?: string | null
                    event_type?: string
                    id?: never
                    payload?: Json | null
                    status?: string
                }
                Relationships: []
            }
            sync_queue: {
                Row: {
                    action: string
                    created_at: string
                    error_message: string | null
                    id: number
                    processed_at: string | null
                    retry_count: number
                    status: string
                    variant_id: number
                }
                Insert: {
                    action: string
                    created_at?: string
                    error_message?: string | null
                    id?: never
                    processed_at?: string | null
                    retry_count?: number
                    status?: string
                    variant_id: number
                }
                Update: {
                    action?: string
                    created_at?: string
                    error_message?: string | null
                    id?: never
                    processed_at?: string | null
                    retry_count?: number
                    status?: string
                    variant_id?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "sync_queue_variant_id_fkey"
                        columns: ["variant_id"]
                        isOneToOne: false
                        referencedRelation: "variants"
                        referencedColumns: ["id"]
                    },
                ]
            }
            variants: {
                Row: {
                    active: boolean
                    attribute_values: string[] | null
                    barcode: string | null
                    compare_at_price: number | null
                    cost: number | null
                    created_at: string
                    id: number
                    price: number
                    product_id: number
                    sku: string | null
                    stock_control: boolean
                    tn_variant_id: number | null
                    updated_at: string
                }
                Insert: {
                    active?: boolean
                    attribute_values?: string[] | null
                    barcode?: string | null
                    compare_at_price?: number | null
                    cost?: number | null
                    created_at?: string
                    id?: never
                    price?: number
                    product_id: number
                    sku?: string | null
                    stock_control?: boolean
                    tn_variant_id?: number | null
                    updated_at?: string
                }
                Update: {
                    active?: boolean
                    attribute_values?: string[] | null
                    barcode?: string | null
                    compare_at_price?: number | null
                    cost?: number | null
                    created_at?: string
                    id?: never
                    price?: number
                    product_id?: number
                    sku?: string | null
                    stock_control?: boolean
                    tn_variant_id?: number | null
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "variants_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            warehouses: {
                Row: {
                    active: boolean
                    created_at: string
                    id: number
                    is_primary: boolean
                    is_virtual: boolean
                    name: string
                    sort_order: number
                    syncs_to_web: boolean
                    updated_at: string
                }
                Insert: {
                    active?: boolean
                    created_at?: string
                    id?: never
                    is_primary?: boolean
                    is_virtual?: boolean
                    name: string
                    sort_order?: number
                    syncs_to_web?: boolean
                    updated_at?: string
                }
                Update: {
                    active?: boolean
                    created_at?: string
                    id?: never
                    is_primary?: boolean
                    is_virtual?: boolean
                    name?: string
                    sort_order?: number
                    syncs_to_web?: boolean
                    updated_at?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
    public: {
        Enums: {},
    },
} as const
