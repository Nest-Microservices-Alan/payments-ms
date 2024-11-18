import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { envs } from 'src/config/envs';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';
import { NATS_SERVICE } from 'src/config/services';
import { ClientProxy } from '@nestjs/microservices';
@Injectable()
export class PaymentsService {

  private readonly stripe = new Stripe(
    envs.stripeSecret
  )

  private readonly logger = new Logger('PaymentsService');

  constructor(
    @Inject(NATS_SERVICE) private readonly client: ClientProxy
  ) {}

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
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    })

    return {
      cancelUrl: session.cancel_url,
      successUrl: session.success_url,
      url: session.url,
    }

  }

  stripeWebhook(req: Request, res: Response) {

    const sig = req.headers['stripe-signature']
    
    let event: Stripe.Event;
    
    //Production
    const endpointSecret = envs.stripeEndpointSecret

    try {
      event = this.stripe.webhooks.constructEvent(req['rawBody'], sig, endpointSecret)
    } catch (error) {
      res.status(400).send(`Webhook Error: ${error.message}`)
      return;
    }
    
    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object;

        const payload = {
          stripePaymentId: chargeSucceeded.id,
          orderId: chargeSucceeded.metadata.orderId,
          receiptUrl: chargeSucceeded.receipt_url,
        }

        // this.logger.log({ payload });
        this.client.emit('payment.succeeded', payload );
        
      break;
      
      default:
        console.log(`Event ${event.type} not handled`)
      break;
    }
    

    return res.status(200).json({sig})

  }

}
