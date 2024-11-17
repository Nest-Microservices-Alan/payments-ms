import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { envs } from 'src/config/envs';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {

  private readonly stripe = new Stripe(
    envs.stripeSecret
  )

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

    const { currency, items, orderId } = paymentSessionDto;


    const lineItems = items.map((item) => {
      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.name
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity
      }
    })


    const session = await this.stripe.checkout.sessions.create({
      //Colocar aqui el ID de mi order
      payment_intent_data: {
        metadata: {
          orderId: orderId
        }
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: 'http://localhost:3003/payments/success',
      cancel_url: 'http://localhost:3003/payments/cancel',
    })

    return session;

  }

  stripeWebhook(req: Request, res: Response) {

    const sig = req.headers['stripe-signature']
    
    let event: Stripe.Event;
    //Testing
    //const endpointSecret = "whsec_8f0790986ef8a1f8f68949a4f4de7e2a68f0f4fe98d9d65f9f35758283cebeb1";
    
    //Production
    const endpointSecret = "whsec_2rL4cvspT0W40luboCA8Bpwnctxv4DjU"

    try {
      event = this.stripe.webhooks.constructEvent(req['rawBody'], sig, endpointSecret)
    } catch (error) {
      res.status(400).send(`Webhook Error: ${error.message}`)
      return;
    }
    
    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceded = event.data.object;

        console.log({
          metadata: chargeSucceded.metadata
        });
      break;
      
      default:
        console.log(`Event ${event.type} not handled`)
      break;
    }
    

    return res.status(200).json({sig})

  }

}
