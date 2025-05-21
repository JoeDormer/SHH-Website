from flask import Flask, request, jsonify
import os
import requests
import xmltodict
from dotenv import load_dotenv
from flask_cors import CORS
import stripe

# Load environment
load_dotenv()
SF_SESSION_ID = os.getenv('SF_SESSION_ID')
SF_AVAIL_URL   = os.getenv('SF_AVAIL_URL')
SF_BOOK_URL = os.getenv('SF_BOOK_URL') 

STRIPE_API_KEY     = os.getenv('STRIPE_SECRET_KEY')
PRODUCT_ID        = os.getenv('STRIPE_PRODUCT_ID')
PRICE_ID            = os.getenv('STRIPE_PRICE_ID')

stripe.api_key = STRIPE_API_KEY

app = Flask(__name__)
CORS(app)



if not all([stripe.api_key, PRODUCT_ID, PRICE_ID]):
    raise RuntimeError("Missing STRIPE_SECRET_KEY, STRIPE_PRODUCT_ID or STRIPE_PRICE_ID")

# 1 network call per server startup:
_product = stripe.Product.retrieve(PRODUCT_ID)
_price   = stripe.Price.retrieve(PRICE_ID)

CACHED_PRODUCT_NAME   = _product.name
CACHED_UNIT_AMOUNT    = _price.unit_amount   # in pence
CACHED_CURRENCY       = _price.currency



@app.route('/api/available-slots', methods=['POST'])
def available_slots():
    data = request.get_json(force=True)
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<request>
  <AvailabilityRequest xmlns="http://soap.sforce.com/schemas/class/SVMX_QuerySlots">
    <ClientId>{data.get('clientId')}</ClientId>
    <ClientReference>{data.get('clientRef')}</ClientReference>
    <VisitType>{data.get('visitType')}</VisitType>
    <PostCode>{data.get('postcode')}</PostCode>
    <EarliestDate>{data.get('earliestDate')}</EarliestDate>
    <LatestDate>{data.get('latestDate')}</LatestDate>
  </AvailabilityRequest>
</request>'''
    headers = {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml',
        'Authorization': f'Bearer {SF_SESSION_ID}'
    }
    try:
        resp = requests.post(SF_AVAIL_URL, data=xml, headers=headers)
        resp.raise_for_status()
        # Parse XML
        doc = xmltodict.parse(resp.text)
        app.logger.debug(f"doc keys: {list(doc.keys())}")
        root = doc.get('response', doc)
        app.logger.debug(f"root keys: {list(root.keys())}")
        # Attempt to extract slots by possible tag names
        slots_raw = (root.get('AvailabilityResponse:Slot')
                     or root.get('Slot')
                     or root.get('slot')  # try lowercase if needed
                     or [])
        if isinstance(slots_raw, dict):
            slots_raw = [slots_raw]
        slots = []
        for s in slots_raw:
            # xmltodict stores each attribute as a key prefixed with '@'
            visit_date = s.get('@VisitDate')
            window_start = s.get('@VisitWindowStart')
            window_end = s.get('@VisitWindowEnd')
            availability = s.get('@Availability')
            engineers = int(s.get('@EngineerCount', '0'))
            slots.append({
                'visitDate': visit_date,
                'windowStart': window_start,
                'windowEnd': window_end,
                'availability': availability,
                'engineers': engineers
            })
        # Return slots array
        return jsonify(slots=slots)
    except Exception as e:
        return jsonify(error=str(e), rawResponse=resp.text if 'resp' in locals() else None), 500
    




@app.route('/api/book-slot', methods=['POST'])
def book_slot():
    if not SF_BOOK_URL:
        app.logger.error("SF_BOOK_URL is not set")
        return jsonify(success=False, error="Server misconfiguration"), 500

    data = request.get_json(force=True)
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<request>
  <ReservationRequest xmlns="http://soap.sforce.com/schemas/class/SVMX_BookSlotAPI">
    <ClientId>{data["clientId"]}</ClientId>
    <ClientReference>{data["clientReference"]}</ClientReference>
    <VisitType>{data["visitType"]}</VisitType>
    <PostCode>{data["postcode"]}</PostCode>
    <VisitDate>{data["visitDate"]}</VisitDate>
    <VisitWindowStart>{data["visitWindowStart"]}</VisitWindowStart>
    <VisitWindowEnd>{data["visitWindowEnd"]}</VisitWindowEnd>
    <BookingTimeoutPeriod>{data["bookingTimeoutPeriod"]}</BookingTimeoutPeriod>
  </ReservationRequest>
</request>'''
    headers = {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml',
        'Authorization': f'Bearer {SF_SESSION_ID}'
    }

    try:
        resp = requests.post(SF_BOOK_URL, data=xml, headers=headers)
        resp.raise_for_status()
    except requests.RequestException as e:
        app.logger.exception("HTTP error during booking")
        return jsonify(
            success=False,
            error=str(e),
            rawResponse=getattr(e.response, 'text', None)
        ), 500

    # Parse the XML response
    try:
        doc = xmltodict.parse(resp.text)
        root = doc.get('response', {})

        # Namespace-prefixed keys:
        reference = root.get('ReservationResponse:Reference') or root.get('Reference')
        resp_el   = root.get('ReservationResponse:Response') or root.get('Response', {})
        code      = resp_el.get('ReservationResponse:Code') or resp_el.get('Code')
        message   = resp_el.get('ReservationResponse:Message') or resp_el.get('Message', '')
        success_t = root.get('ReservationResponse:Success') or root.get('Success', 'false')
        summary   = root.get('ReservationResponse:Summary') or root.get('Summary', '')

        success = str(success_t).lower() == 'true'

        if not success or code != '000':
            app.logger.warning(f"Booking failed: code={code}, msg={message}")
            return jsonify(
                success=False,
                code=code,
                message=message or 'Booking error',
                rawResponse=resp.text
            ), 400

        return jsonify(
            success=True,
            reference=reference,
            summary=summary
        )
    except Exception as e:
        app.logger.exception("Failed parsing booking response")
        return jsonify(
            success=False,
            error=f"XML parse error: {e}",
            rawResponse=resp.text
        ), 500


@app.route('/api/create-payment-intent', methods=['POST'])
def create_payment_intent():
    data = request.get_json(force=True)
    reference     = data.get('reference', '')
    # retrieve booking data from the front-end (we’ll send it below)
    form          = data.get('form', {})
    selectedDate  = data.get('selectedDate', '')
    selectedTime  = data.get('selectedTime', '')

    # assume you’ve cached amount/currency/product_name as before...
    try:
        intent = stripe.PaymentIntent.create(
            amount   = CACHED_UNIT_AMOUNT,
            currency = CACHED_CURRENCY,
            metadata = {
                'reference':    reference,
                'firstName':    form.get('firstName',''),
                'surname':      form.get('surname',''),
                'phone':        form.get('phone',''),
                'email':        form.get('email',''),
                'address':      form.get('address',''),
                'postcode':     form.get('postcode',''),
                
                'visitDate':    selectedDate,
                'visitWindow':  selectedTime,
            }
        )
        return jsonify({
            'clientSecret': intent.client_secret,
            'productName':  CACHED_PRODUCT_NAME,
            'unitAmount':   CACHED_UNIT_AMOUNT,
            'currency':     CACHED_CURRENCY,
            'booking': {
              **form,
              'visitDate':    selectedDate,
              'visitWindow':  selectedTime,
              'reference':    reference
            }
        })
    except stripe.error.StripeError as e:
        return jsonify(error=str(e)), 400



if __name__ == '__main__':

    import os
# Use the PORT Render injects; fall back to 3001 locally
    port = int(os.environ.get('PORT', 3001))
    # Bind to all interfaces, disable debug
    app.run(host='0.0.0.0', port=port, debug=False)