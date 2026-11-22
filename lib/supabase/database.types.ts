
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "fridge_items": {
                  Row: {
                    "best_before": string | null,"created_at": string,"household_id": string,"id": string,"ingredient_id": string | null,"label": string,"origin": Database["public"]['Enums']["fridge_origin"],"quantity": number | null,"recipe_id": string | null,"reserved_list_id": string | null,"unit": Database["public"]['Enums']["shopping_unit"] | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "best_before"?: string | null,"created_at"?: string,"household_id": string,"id"?: string,"ingredient_id"?: string | null,"label": string,"origin"?: Database["public"]['Enums']["fridge_origin"],"quantity"?: number | null,"recipe_id"?: string | null,"reserved_list_id"?: string | null,"unit"?: Database["public"]['Enums']["shopping_unit"] | null,"updated_at"?: string
                  }
                  Update: {
                    "best_before"?: string | null,"created_at"?: string,"household_id"?: string,"id"?: string,"ingredient_id"?: string | null,"label"?: string,"origin"?: Database["public"]['Enums']["fridge_origin"],"quantity"?: number | null,"recipe_id"?: string | null,"reserved_list_id"?: string | null,"unit"?: Database["public"]['Enums']["shopping_unit"] | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fridge_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fridge_items_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fridge_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fridge_items_reserved_list_id_fkey"
      columns: ["reserved_list_id"]
isOneToOne: false
      referencedRelation: "shopping_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"household_invites": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"expires_at": string,"household_id": string,"id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["household_role"],"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"household_id": string,"id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["household_role"],"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"household_id"?: string,"id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["household_role"],"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_invites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_users": {
                  Row: {
                    "created_at": string,"household_id": string,"member_chosen_at": string | null,"member_id": string | null,"role": Database["public"]['Enums']["household_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"member_chosen_at"?: string | null,"member_id"?: string | null,"role"?: Database["public"]['Enums']["household_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"member_chosen_at"?: string | null,"member_id"?: string | null,"role"?: Database["public"]['Enums']["household_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_users_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "household_users_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ingredients": {
                  Row: {
                    "aisle": Database["public"]['Enums']["grocery_aisle"],"aliases": (string)[],"created_at": string,"grams_per_ml": number | null,"household_id": string | null,"id": string,"name": string,"name_key": string | null,"pantry": boolean,"piece_grams": number | null,"shelf_life_days": number | null,"shopping_unit": Database["public"]['Enums']["shopping_unit"]
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle"?: Database["public"]['Enums']["grocery_aisle"],"aliases"?: (string)[],"created_at"?: string,"grams_per_ml"?: number | null,"household_id"?: string | null,"id"?: string,"name": string,"name_key"?: never,"pantry"?: boolean,"piece_grams"?: number | null,"shelf_life_days"?: number | null,"shopping_unit"?: Database["public"]['Enums']["shopping_unit"]
                  }
                  Update: {
                    "aisle"?: Database["public"]['Enums']["grocery_aisle"],"aliases"?: (string)[],"created_at"?: string,"grams_per_ml"?: number | null,"household_id"?: string | null,"id"?: string,"name"?: string,"name_key"?: never,"pantry"?: boolean,"piece_grams"?: number | null,"shelf_life_days"?: number | null,"shopping_unit"?: Database["public"]['Enums']["shopping_unit"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingredients_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_slots": {
                  Row: {
                    "created_at": string,"day": number,"household_id": string,"id": string,"meal_type": Database["public"]['Enums']["meal_type"],"member_ids": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": number,"household_id": string,"id"?: string,"meal_type": Database["public"]['Enums']["meal_type"],"member_ids": (string)[]
                  }
                  Update: {
                    "created_at"?: string,"day"?: number,"household_id"?: string,"id"?: string,"meal_type"?: Database["public"]['Enums']["meal_type"],"member_ids"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_slots_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "appetite": Database["public"]['Enums']["appetite"],"birth_year": number,"color": number,"created_at": string,"diets": (Database["public"]['Enums']["diet"])[],"first_name": string,"household_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appetite"?: Database["public"]['Enums']["appetite"],"birth_year": number,"color"?: number,"created_at"?: string,"diets"?: (Database["public"]['Enums']["diet"])[],"first_name": string,"household_id": string,"id"?: string
                  }
                  Update: {
                    "appetite"?: Database["public"]['Enums']["appetite"],"birth_year"?: number,"color"?: number,"created_at"?: string,"diets"?: (Database["public"]['Enums']["diet"])[],"first_name"?: string,"household_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"planned_meals": {
                  Row: {
                    "created_at": string,"day": number,"household_id": string,"id": string,"locked": boolean,"meal_type": Database["public"]['Enums']["meal_type"],"member_ids": (string)[],"position": number,"recipe_id": string,"skipped": boolean,"week_plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": number,"household_id": string,"id"?: string,"locked"?: boolean,"meal_type": Database["public"]['Enums']["meal_type"],"member_ids": (string)[],"position"?: number,"recipe_id": string,"skipped"?: boolean,"week_plan_id": string
                  }
                  Update: {
                    "created_at"?: string,"day"?: number,"household_id"?: string,"id"?: string,"locked"?: boolean,"meal_type"?: Database["public"]['Enums']["meal_type"],"member_ids"?: (string)[],"position"?: number,"recipe_id"?: string,"skipped"?: boolean,"week_plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_meals_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meals_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meals_week_plan_id_fkey"
      columns: ["week_plan_id"]
isOneToOne: false
      referencedRelation: "week_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_favorites": {
                  Row: {
                    "created_at": string,"household_id": string,"recipe_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"recipe_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"recipe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_favorites_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_favorites_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_ingredients": {
                  Row: {
                    "aisle": Database["public"]['Enums']["grocery_aisle"],"household_id": string | null,"id": string,"ingredient_id": string | null,"name": string,"position": number,"quantity": number | null,"recipe_id": string,"unit": Database["public"]['Enums']["ingredient_unit"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle"?: Database["public"]['Enums']["grocery_aisle"],"household_id"?: string | null,"id"?: string,"ingredient_id"?: string | null,"name": string,"position"?: number,"quantity"?: number | null,"recipe_id": string,"unit"?: Database["public"]['Enums']["ingredient_unit"] | null
                  }
                  Update: {
                    "aisle"?: Database["public"]['Enums']["grocery_aisle"],"household_id"?: string | null,"id"?: string,"ingredient_id"?: string | null,"name"?: string,"position"?: number,"quantity"?: number | null,"recipe_id"?: string,"unit"?: Database["public"]['Enums']["ingredient_unit"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipe_member_exclusions": {
                  Row: {
                    "created_at": string,"household_id": string,"member_id": string,"recipe_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"member_id": string,"recipe_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"member_id"?: string,"recipe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_member_exclusions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_member_exclusions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_member_exclusions_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "base": string | null,"basic": boolean,"batch_friendly": boolean,"batch_notes": string | null,"cook_minutes": number,"course": Database["public"]['Enums']["course"],"created_at": string,"description": string | null,"diets": (Database["public"]['Enums']["diet"])[],"household_id": string | null,"id": string,"kid_friendly": boolean,"meal_types": (Database["public"]['Enums']["meal_type"])[],"photo_url": string | null,"prep_minutes": number,"servings": number,"source_recipe_id": string | null,"steps": (string)[],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base"?: string | null,"basic"?: boolean,"batch_friendly"?: boolean,"batch_notes"?: string | null,"cook_minutes"?: number,"course"?: Database["public"]['Enums']["course"],"created_at"?: string,"description"?: string | null,"diets"?: (Database["public"]['Enums']["diet"])[],"household_id"?: string | null,"id"?: string,"kid_friendly"?: boolean,"meal_types": (Database["public"]['Enums']["meal_type"])[],"photo_url"?: string | null,"prep_minutes"?: number,"servings": number,"source_recipe_id"?: string | null,"steps"?: (string)[],"title": string
                  }
                  Update: {
                    "base"?: string | null,"basic"?: boolean,"batch_friendly"?: boolean,"batch_notes"?: string | null,"cook_minutes"?: number,"course"?: Database["public"]['Enums']["course"],"created_at"?: string,"description"?: string | null,"diets"?: (Database["public"]['Enums']["diet"])[],"household_id"?: string | null,"id"?: string,"kid_friendly"?: boolean,"meal_types"?: (Database["public"]['Enums']["meal_type"])[],"photo_url"?: string | null,"prep_minutes"?: number,"servings"?: number,"source_recipe_id"?: string | null,"steps"?: (string)[],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_source_recipe_id_fkey"
      columns: ["source_recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_items": {
                  Row: {
                    "aisle": Database["public"]['Enums']["grocery_aisle"],"amounts": NonNullable<Json>,"checked": boolean,"created_at": string,"from_fridge": number,"household_id": string,"id": string,"ingredient_id": string | null,"label": string,"list_id": string,"manual": boolean,"maybe_in_fridge": boolean,"needed": boolean,"pantry": boolean,"position": number,"quantity_changed": boolean,"quantity_text": string | null,"removed": boolean,"sources": NonNullable<Json>,"stored": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle"?: Database["public"]['Enums']["grocery_aisle"],"amounts"?: NonNullable<Json>,"checked"?: boolean,"created_at"?: string,"from_fridge"?: number,"household_id": string,"id"?: string,"ingredient_id"?: string | null,"label": string,"list_id": string,"manual"?: boolean,"maybe_in_fridge"?: boolean,"needed"?: boolean,"pantry"?: boolean,"position"?: number,"quantity_changed"?: boolean,"quantity_text"?: string | null,"removed"?: boolean,"sources"?: NonNullable<Json>,"stored"?: boolean
                  }
                  Update: {
                    "aisle"?: Database["public"]['Enums']["grocery_aisle"],"amounts"?: NonNullable<Json>,"checked"?: boolean,"created_at"?: string,"from_fridge"?: number,"household_id"?: string,"id"?: string,"ingredient_id"?: string | null,"label"?: string,"list_id"?: string,"manual"?: boolean,"maybe_in_fridge"?: boolean,"needed"?: boolean,"pantry"?: boolean,"position"?: number,"quantity_changed"?: boolean,"quantity_text"?: string | null,"removed"?: boolean,"sources"?: NonNullable<Json>,"stored"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_items_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_items_ingredient_id_fkey"
      columns: ["ingredient_id"]
isOneToOne: false
      referencedRelation: "ingredients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "shopping_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_lists": {
                  Row: {
                    "fridge_signature": string,"household_id": string,"id": string,"menu_signature": string,"settled_at": string | null,"stored_at": string | null,"updated_at": string,"week_plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fridge_signature"?: string,"household_id": string,"id"?: string,"menu_signature"?: string,"settled_at"?: string | null,"stored_at"?: string | null,"updated_at"?: string,"week_plan_id": string
                  }
                  Update: {
                    "fridge_signature"?: string,"household_id"?: string,"id"?: string,"menu_signature"?: string,"settled_at"?: string | null,"stored_at"?: string | null,"updated_at"?: string,"week_plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_lists_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_lists_week_plan_id_fkey"
      columns: ["week_plan_id"]
isOneToOne: true
      referencedRelation: "week_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"week_meal_overrides": {
                  Row: {
                    "created_at": string,"day": number,"household_id": string,"id": string,"meal_type": Database["public"]['Enums']["meal_type"],"member_ids": (string)[],"week_plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": number,"household_id": string,"id"?: string,"meal_type": Database["public"]['Enums']["meal_type"],"member_ids"?: (string)[],"week_plan_id": string
                  }
                  Update: {
                    "created_at"?: string,"day"?: number,"household_id"?: string,"id"?: string,"meal_type"?: Database["public"]['Enums']["meal_type"],"member_ids"?: (string)[],"week_plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "week_meal_overrides_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "week_meal_overrides_week_plan_id_fkey"
      columns: ["week_plan_id"]
isOneToOne: false
      referencedRelation: "week_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"week_plans": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"seed": number,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"id"?: string,"seed"?: number,"week_start": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"seed"?: number,"week_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "week_plans_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "known_ingredients": {
                  Row: {
                    "aisle": Database["public"]['Enums']["grocery_aisle"],"name": string,"unit": Database["public"]['Enums']["ingredient_unit"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_household_invite":
{ Args: { "invite_code": string,"leave_current"?: boolean }; Returns: string
                           },
"add_planned_extras":
{ Args: { "items": Json,"target_household_id": string,"target_week_start": string }; Returns: {
              "created_at": string,
"day": number,
"household_id": string,
"id": string,
"locked": boolean,
"meal_type": Database["public"]['Enums']["meal_type"],
"member_ids": (string)[],
"position": number,
"recipe_id": string,
"skipped": boolean,
"week_plan_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "planned_meals"
        isOneToOne: false
        isSetofReturn: true
      } },
"add_planned_meal":
{ Args: { "eater_ids": (string)[],"target_day": number,"target_household_id": string,"target_meal_type": Database["public"]['Enums']["meal_type"],"target_recipe_id": string,"target_week_start": string }; Returns: string
                           },
"add_shopping_item":
{ Args: { "quantity_text": string,"raw_label": string,"target_list_id": string }; Returns: string
                           },
"apply_fridge_settlement":
{ Args: { "changes": Json,"target_list_id": string }; Returns: boolean
                           },
"copy_recipe":
{ Args: { "catalog_recipe_id": string,"target_household_id": string }; Returns: string
                           },
"create_household":
{ Args: { "household_name": string }; Returns: string
                           },
"create_household_invite":
{ Args: { "invite_role"?: Database["public"]['Enums']["household_role"],"target_household_id": string }; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"household_accounts":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"is_me": boolean,"joined_at": string,"member_chosen_at": string,"member_id": string,"role": Database["public"]['Enums']["household_role"],"user_id": string
            }[]
                           },
"household_invite_preview":
{ Args: { "invite_code": string }; Returns: {
              "household_name": string,"inviter_name": string,"is_member": boolean,"status": string
            }[]
                           },
"leave_household":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"remove_household_account":
{ Args: { "target_user_id": string }; Returns: undefined
                           },
"reset_week_meals":
{ Args: { "target_household_id": string,"target_week_start": string }; Returns: undefined
                           },
"revoke_household_invite":
{ Args: { "invite_id": string }; Returns: undefined
                           },
"save_recipe":
{ Args: { "excluded_member_ids": (string)[],"ingredients": Json,"recipe": Json,"target_household_id": string,"target_recipe_id"?: string }; Returns: string
                           },
"save_week_proposal":
{ Args: { "cards": Json,"new_seed": number,"target_household_id": string,"target_week_start": string }; Returns: string
                           },
"set_household_invite_role":
{ Args: { "invite_id": string,"new_role": Database["public"]['Enums']["household_role"] }; Returns: undefined
                           },
"set_household_role":
{ Args: { "new_role": Database["public"]['Enums']["household_role"],"target_user_id": string }; Returns: undefined
                           },
"set_my_member":
{ Args: { "target_member_id": string }; Returns: undefined
                           },
"set_planned_meal_eaters":
{ Args: { "eater_ids": (string)[],"target_card_id": string }; Returns: undefined
                           },
"set_week_meal":
{ Args: { "eater_ids": (string)[],"target_day": number,"target_household_id": string,"target_meal_type": Database["public"]['Enums']["meal_type"],"target_week_start": string }; Returns: undefined
                           },
"store_groceries":
{ Args: { "entries": Json,"target_list_id": string }; Returns: number
                           },
"swap_planned_meals":
{ Args: { "first_id": string,"second_id": string }; Returns: undefined
                           },
"sync_shopping_list":
{ Args: { "fridge": string,"items": Json,"signature": string,"target_week_plan_id": string }; Returns: string
                           }
          }
          Enums: {
            "appetite": "normal"|"grand","course": "starter"|"main"|"dessert"|"fruit"|"cheese"|"dairy","diet": "keto"|"vegetarian"|"gluten_free"|"lactose_free","fridge_origin": "manual"|"shopping"|"leftover","grocery_aisle": "fruits_legumes"|"boucherie"|"poissonnerie"|"cremerie"|"epicerie"|"surgeles"|"boulangerie"|"boissons"|"autre","household_role": "admin"|"member","ingredient_unit": "g"|"kg"|"ml"|"l"|"piece"|"cas"|"cac","meal_type": "petit_dej"|"midi"|"soir"|"pique_nique","shopping_unit": "g"|"ml"|"piece"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "appetite": ["normal", "grand"],"course": ["starter", "main", "dessert", "fruit", "cheese", "dairy"],"diet": ["keto", "vegetarian", "gluten_free", "lactose_free"],"fridge_origin": ["manual", "shopping", "leftover"],"grocery_aisle": ["fruits_legumes", "boucherie", "poissonnerie", "cremerie", "epicerie", "surgeles", "boulangerie", "boissons", "autre"],"household_role": ["admin", "member"],"ingredient_unit": ["g", "kg", "ml", "l", "piece", "cas", "cac"],"meal_type": ["petit_dej", "midi", "soir", "pique_nique"],"shopping_unit": ["g", "ml", "piece"]
          }
        }
} as const
