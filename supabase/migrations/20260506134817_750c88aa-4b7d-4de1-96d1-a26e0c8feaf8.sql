UPDATE public.profiles
SET stripe_customer_id = NULL,
    stripe_subscription_id = NULL,
    subscription_status = 'free'
WHERE stripe_customer_id = 'cus_UQSsGX645jfgFr';